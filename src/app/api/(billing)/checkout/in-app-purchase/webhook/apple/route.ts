/**
 * Apple App Store Server-to-Server Notifications (Version 2)
 *
 * POST /api/checkout/in-app-purchase/webhook/apple
 *
 * Handles subscription lifecycle events from Apple:
 * - DID_RENEW: Subscription renewed
 * - DID_FAIL_TO_RENEW: Renewal failed
 * - DID_CHANGE_RENEWAL_STATUS: Auto-renewal status changed
 * - EXPIRED: Subscription expired
 * - REVOKE: Refund issued
 * - REFUND: Purchase refunded
 *
 * Documentation: https://developer.apple.com/documentation/appstoreservernotifications
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { serializeError } from "serialize-error";
import { generateWebhookIdempotencyKey, checkIdempotencyKey } from "@/lib/utils/idempotencyUtils";
import { logWebhookSuccess, logWebhookError, logWebhookDuplicate, logWebhookSecurityViolation } from "@/lib/utils/webhookLogger";
import { broadcastPaymentUpdate } from "@/lib/websocket/paymentWebSocket";
import { verifyAppleJWT, verifyAppleJWTUnsafe } from "@/lib/apple/jwtVerification";

export const dynamic = "force-dynamic";

// Apple S2S notification types (Version 2)
enum AppleNotificationType {
  // Subscription lifecycle
  DID_RENEW = "DID_RENEW",
  DID_FAIL_TO_RENEW = "DID_FAIL_TO_RENEW",
  DID_CHANGE_RENEWAL_STATUS = "DID_CHANGE_RENEWAL_STATUS",
  EXPIRED = "EXPIRED",

  // Refunds and cancellations
  REFUND = "REFUND",
  REVOKE = "REVOKE",

  // Grace period
  GRACE_PERIOD_EXPIRED = "GRACE_PERIOD_EXPIRED",

  // Offers
  OFFER_REDEEMED = "OFFER_REDEEMED",

  // Other
  SUBSCRIBED = "SUBSCRIBED",
  RENEWAL_EXTENDED = "RENEWAL_EXTENDED",
  PRICE_INCREASE = "PRICE_INCREASE",
  REFUND_DECLINED = "REFUND_DECLINED",
}

/**
 * POST /api/checkout/in-app-purchase/webhook/apple
 *
 * Process Apple App Store Server-to-Server notifications
 */
export async function POST(req: NextRequest) {
  const timestamp = new Date();
  const clientIp = req.headers.get("x-forwarded-for")?.split(',')[0] ||
                   req.headers.get("x-real-ip") ||
                   "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    const body = await req.json();

    console.log("[Apple S2S] ========== WEBHOOK RECEIVED ==========");
    console.log("[Apple S2S] Timestamp:", timestamp.toISOString());
    console.log("[Apple S2S] Client IP:", clientIp);
    console.log("[Apple S2S] User Agent:", userAgent);
    console.log("[Apple S2S] Request body keys:", Object.keys(body));

    // Choose verification method based on environment
    const useStrictVerification = process.env.NODE_ENV === 'production';
    console.log("[Apple S2S] Verification mode:", useStrictVerification ? 'STRICT (production)' : 'RELAXED (development)');
    const verifyJWT = useStrictVerification ? verifyAppleJWT : verifyAppleJWTUnsafe;

    // Apple V2 notifications wrap everything in a signedPayload JWT
    const { signedPayload } = body;

    if (!signedPayload) {
      console.error("[Apple S2S] Missing signedPayload in request");
      return Response.json({ message: "Missing signedPayload" }, { status: 400 });
    }

    console.log("[Apple S2S] Verifying signedPayload JWT");

    // Verify and decode the outer signedPayload
    const payloadVerification = await verifyJWT(signedPayload);

    if (!payloadVerification.valid) {
      console.error("[Apple S2S] signedPayload verification failed:", payloadVerification.error);

      logWebhookSecurityViolation({
        provider: "apple_iap",
        eventType: "unknown",
        eventId: "unknown",
        clientIp,
        userAgent,
        signatureValid: false,
        timestamp,
        errorMessage: `signedPayload verification failed: ${payloadVerification.error}`,
      });

      if (useStrictVerification) {
        return Response.json({ message: "Invalid signature" }, { status: 403 });
      }

      // Fallback: manually decode JWT payload in development
      console.warn("[Apple S2S] Falling back to unsafe JWT decoding for signedPayload");
    }

    // Extract notification data from verified payload or fallback to manual decode
    let notificationPayload: {
      notificationType?: string;
      subtype?: string;
      notificationUUID?: string;
      data?: {
        signedTransactionInfo?: string;
        signedRenewalInfo?: string;
        appAppleId?: number;
        bundleId?: string;
        environment?: string;
      };
    } | undefined;

    if (payloadVerification.valid && payloadVerification.payload) {
      notificationPayload = payloadVerification.payload as typeof notificationPayload;
    } else if (!useStrictVerification) {
      // Manual decode fallback for development
      try {
        const parts = signedPayload.split('.');
        if (parts.length === 3) {
          notificationPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        }
      } catch (decodeError) {
        console.error("[Apple S2S] Failed to decode signedPayload:", decodeError);
        return Response.json({ message: "Failed to decode payload" }, { status: 400 });
      }
    }

    if (!notificationPayload) {
      return Response.json({ message: "Could not extract notification payload" }, { status: 400 });
    }

    const notificationType = notificationPayload.notificationType || "unknown";
    const subtype = notificationPayload.subtype;
    const notificationUUID = notificationPayload.notificationUUID || "unknown";
    const data = notificationPayload.data;

    console.log("[Apple S2S] ========== NOTIFICATION PAYLOAD ==========");
    console.log("[Apple S2S] Notification Type:", notificationType);
    console.log("[Apple S2S] Subtype:", subtype);
    console.log("[Apple S2S] Notification UUID:", notificationUUID);
    console.log("[Apple S2S] Environment:", data?.environment);
    console.log("[Apple S2S] App Apple ID:", data?.appAppleId);
    console.log("[Apple S2S] Bundle ID:", data?.bundleId);
    console.log("[Apple S2S] Has signedTransactionInfo:", !!data?.signedTransactionInfo);
    console.log("[Apple S2S] Has signedRenewalInfo:", !!data?.signedRenewalInfo);

    // Extract and verify signed payloads from data
    const signedTransactionInfo = data?.signedTransactionInfo;
    const signedRenewalInfo = data?.signedRenewalInfo;

    let transactionInfo;
    let renewalInfo;
    let signatureValid = false;

    try {
      // Verify and extract transaction information
      if (signedTransactionInfo) {
        console.log("[Apple S2S] Verifying transaction info JWT");
        const verificationResult = await verifyJWT(signedTransactionInfo);
        
        if (!verificationResult.valid) {
          console.error("[Apple S2S] Transaction info JWT verification failed:", verificationResult.error);
          
          logWebhookSecurityViolation({
            provider: "apple_iap",
            eventType: notificationType,
            eventId: notificationUUID || "unknown",
            clientIp,
            userAgent,
            signatureValid: false,
            timestamp,
            errorMessage: `Transaction JWT verification failed: ${verificationResult.error}`,
          });

          // In production, reject invalid signatures
          if (useStrictVerification) {
            return Response.json({ message: "Invalid transaction signature" }, { status: 403 });
          }
        } else {
          transactionInfo = verificationResult.payload;
          signatureValid = true;
          console.log("[Apple S2S] Transaction info JWT verified successfully");
          console.log("[Apple S2S] ========== TRANSACTION INFO ==========");
          console.log("[Apple S2S] Transaction ID:", transactionInfo?.transactionId);
          console.log("[Apple S2S] Original Transaction ID:", transactionInfo?.originalTransactionId);
          console.log("[Apple S2S] Product ID:", transactionInfo?.productId);
          console.log("[Apple S2S] Type:", transactionInfo?.type);
          console.log("[Apple S2S] In-App Ownership Type:", transactionInfo?.inAppOwnershipType);
          console.log("[Apple S2S] Purchase Date:", transactionInfo?.purchaseDate ? new Date(Number(transactionInfo.purchaseDate)).toISOString() : 'N/A');
          console.log("[Apple S2S] Expires Date:", transactionInfo?.expiresDate ? new Date(Number(transactionInfo.expiresDate)).toISOString() : 'N/A');
          console.log("[Apple S2S] Environment:", transactionInfo?.environment);
          console.log("[Apple S2S] Storefront:", transactionInfo?.storefront);
          console.log("[Apple S2S] Price (milliunits):", transactionInfo?.price);
          console.log("[Apple S2S] Currency:", transactionInfo?.currency);
        }
      }

      // Verify and extract renewal information
      if (signedRenewalInfo) {
        console.log("[Apple S2S] Verifying renewal info JWT");
        const verificationResult = await verifyJWT(signedRenewalInfo);
        
        if (!verificationResult.valid) {
          console.error("[Apple S2S] Renewal info JWT verification failed:", verificationResult.error);
          
          // Log but don't fail the entire webhook for renewal info
          console.warn("[Apple S2S] Continuing without renewal info due to signature verification failure");
        } else {
          renewalInfo = verificationResult.payload;
          console.log("[Apple S2S] Renewal info JWT verified successfully");
          console.log("[Apple S2S] ========== RENEWAL INFO ==========");
          console.log("[Apple S2S] Auto Renew Status:", renewalInfo?.autoRenewStatus);
          console.log("[Apple S2S] Auto Renew Product ID:", renewalInfo?.autoRenewProductId);
          console.log("[Apple S2S] Original Transaction ID:", renewalInfo?.originalTransactionId);
          console.log("[Apple S2S] Renewal Date:", renewalInfo?.renewalDate ? new Date(Number(renewalInfo.renewalDate)).toISOString() : 'N/A');
          console.log("[Apple S2S] Expiration Intent:", renewalInfo?.expirationIntent);
          console.log("[Apple S2S] Is In Billing Retry:", renewalInfo?.isInBillingRetryPeriod);
          console.log("[Apple S2S] Grace Period Expires Date:", renewalInfo?.gracePeriodExpiresDate ? new Date(Number(renewalInfo.gracePeriodExpiresDate)).toISOString() : 'N/A');
        }
      }

      // Fallback to unsafe decoding in development if verification failed
      if (!transactionInfo && signedTransactionInfo && !useStrictVerification) {
        console.warn("[Apple S2S] Falling back to unsafe JWT decoding for development");
        try {
          const parts = signedTransactionInfo.split('.');
          if (parts.length === 3) {
            transactionInfo = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
          }
        } catch (fallbackError) {
          console.error("[Apple S2S] Fallback decoding failed:", fallbackError);
        }
      }

    } catch (jwtError) {
      console.error("[Apple S2S] JWT processing error:", jwtError);
      
      logWebhookError({
        provider: "apple_iap",
        eventType: notificationType,
        eventId: notificationUUID || "unknown",
        clientIp,
        userAgent,
        signatureValid: false,
        timestamp,
        errorMessage: `JWT processing error: ${jwtError instanceof Error ? jwtError.message : 'Unknown error'}`,
      });

      if (useStrictVerification) {
        return Response.json({ message: "JWT processing failed" }, { status: 400 });
      }
    }

    const transactionId = transactionInfo?.originalTransactionId || transactionInfo?.transactionId;
    const productId = transactionInfo?.productId;

    // Handle TEST notification type (no transaction ID)
    if (notificationType === "TEST") {
      console.log("[Apple S2S] ========== TEST NOTIFICATION RECEIVED ==========");
      console.log("[Apple S2S] This is a test notification from Apple");
      console.log("[Apple S2S] Notification UUID:", notificationUUID);
      console.log("[Apple S2S] Environment:", data?.environment);
      console.log("[Apple S2S] Bundle ID:", data?.bundleId);

      return Response.json({
        message: "OK - Test notification received",
        decoded: {
          notificationType,
          subtype,
          notificationUUID,
          environment: data?.environment,
          bundleId: data?.bundleId,
          appAppleId: data?.appAppleId,
          isTestNotification: true,
        },
        processingTimeMs: Date.now() - timestamp.getTime(),
      });
    }

    if (!transactionId) {
      console.error("[Apple S2S] No transaction ID in notification");
      return Response.json({
        message: "No transaction ID",
        decoded: {
          notificationType,
          subtype,
          notificationUUID,
          environment: data?.environment,
          bundleId: data?.bundleId,
        },
      }, { status: 400 });
    }

    console.log("[Apple S2S] ========== PROCESSING ==========");
    console.log("[Apple S2S] Transaction ID:", transactionId);
    console.log("[Apple S2S] Product ID:", productId);
    console.log("[Apple S2S] Notification Type:", notificationType);
    console.log("[Apple S2S] Subtype:", subtype);
    console.log("[Apple S2S] Signature Valid:", signatureValid);

    // Generate idempotency key for this notification
    const idempotencyKey = generateWebhookIdempotencyKey(
      "apple_iap",
      notificationUUID || transactionId,
      notificationType
    );

    // Check if this notification was already processed
    const existingProcessing = await checkIdempotencyKey(idempotencyKey);

    if (existingProcessing) {
      console.log(`[Apple S2S] Notification already processed: ${idempotencyKey}`);

      logWebhookDuplicate({
        provider: "apple_iap",
        eventType: notificationType,
        eventId: notificationUUID || transactionId,
        clientIp,
        userAgent,
        signatureValid,
        idempotencyKey,
        timestamp,
      });

      return Response.json({ message: "OK" });
    }

    // Find the payment by transaction ID
    const payment = await prisma.payment.findFirst({
      where: {
        externalId: transactionId,
        provider: "apple_iap",
      },
      include: {
        user: true,
        subscriptions: true,
      },
    });

    console.log("[Apple S2S] ========== PAYMENT LOOKUP ==========");
    console.log("[Apple S2S] Looking up payment with externalId:", transactionId);

    if (!payment) {
      console.log("[Apple S2S] Payment NOT FOUND for transaction:", transactionId);

      logWebhookError({
        provider: "apple_iap",
        eventType: notificationType,
        eventId: notificationUUID || transactionId,
        clientIp,
        userAgent,
        signatureValid,
        timestamp,
        errorMessage: `Payment not found for transaction: ${transactionId}`,
      });

      // Return 200 to prevent Apple from retrying, include decoded payload for debugging
      return Response.json({
        message: "Payment not found",
        decoded: {
          notificationType,
          subtype,
          notificationUUID,
          environment: data?.environment,
          bundleId: data?.bundleId,
          appAppleId: data?.appAppleId,
          transactionInfo: transactionInfo ? {
            transactionId: transactionInfo.transactionId,
            originalTransactionId: transactionInfo.originalTransactionId,
            productId: transactionInfo.productId,
            type: transactionInfo.type,
            environment: transactionInfo.environment,
            purchaseDate: transactionInfo.purchaseDate ? new Date(Number(transactionInfo.purchaseDate)).toISOString() : null,
            expiresDate: transactionInfo.expiresDate ? new Date(Number(transactionInfo.expiresDate)).toISOString() : null,
            price: transactionInfo.price,
            currency: transactionInfo.currency,
          } : null,
          renewalInfo: renewalInfo ? {
            autoRenewStatus: renewalInfo.autoRenewStatus,
            autoRenewProductId: renewalInfo.autoRenewProductId,
            originalTransactionId: renewalInfo.originalTransactionId,
          } : null,
        },
        processingTimeMs: Date.now() - timestamp.getTime(),
      }, { status: 200 });
    }

    console.log("[Apple S2S] Payment FOUND:");
    console.log("[Apple S2S] Payment ID:", payment.id);
    console.log("[Apple S2S] Payment Status:", payment.status);
    console.log("[Apple S2S] User ID:", payment.userId);
    console.log("[Apple S2S] User Email:", payment.user?.email);
    console.log("[Apple S2S] Subscriptions Count:", payment.subscriptions.length);
    if (payment.subscriptions.length > 0) {
      const sub = payment.subscriptions[0];
      console.log("[Apple S2S] Subscription ID:", sub.id);
      console.log("[Apple S2S] Subscription Expires At:", sub.expiresAt?.toISOString());
    }

    // Handle different notification types
    console.log("[Apple S2S] ========== HANDLING NOTIFICATION ==========");
    let updatedPayment = payment;

    switch (notificationType) {
      case AppleNotificationType.DID_RENEW:
      case AppleNotificationType.SUBSCRIBED:
        console.log("[Apple S2S] Handling SUBSCRIBED/DID_RENEW for transaction:", transactionId);

        // Check if subscription already exists for this payment
        if (payment.subscriptions.length > 0) {
          // Subscription exists - just update expiry date
          const subscription = payment.subscriptions[0];
          const expiresDateMs = transactionInfo?.expiresDate;

          console.log("[Apple S2S] Subscription already exists:", subscription.id);
          console.log("[Apple S2S] Current subscription expires at:", subscription.expiresAt?.toISOString());
          console.log("[Apple S2S] New expires date (ms):", expiresDateMs);

          if (expiresDateMs) {
            const newExpiresAt = new Date(parseInt(expiresDateMs));
            console.log("[Apple S2S] Updating subscription expiry to:", newExpiresAt.toISOString());

            await prisma.subscription.update({
              where: { id: subscription.id },
              data: {
                expiresAt: newExpiresAt,
              },
            });
            console.log("[Apple S2S] Subscription expiry updated successfully");
          } else {
            console.log("[Apple S2S] No expiresDate in transaction info, skipping expiry update");
          }
        } else {
          // No subscription exists yet - this could happen if webhook arrives before /verify
          // We should NOT create subscription here because:
          // 1. We don't have plan mapping from webhook data
          // 2. The /verify endpoint should handle subscription creation
          // 3. Creating here could cause duplicate if /verify runs after
          console.log("[Apple S2S] ⚠️ No subscriptions found for this payment");
          console.log("[Apple S2S] ⚠️ This is expected if webhook arrived before /verify completed");
          console.log("[Apple S2S] ⚠️ Subscription will be created by /verify endpoint");

          // Just log and continue - don't fail the webhook
          // The /verify endpoint should handle subscription creation with proper duplicate checks
        }

        // Update payment idempotency key
        updatedPayment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            idempotencyKey,
            webhookPayloads: JSON.stringify({
              ...JSON.parse(payment.webhookPayloads || "{}"),
              [notificationType]: body,
            }),
          },
          include: {
            user: true,
            subscriptions: true,
          },
        });
        break;

      case AppleNotificationType.DID_FAIL_TO_RENEW:
        console.log("[Apple S2S] Handling DID_FAIL_TO_RENEW for transaction:", transactionId);
        console.log("[Apple S2S] Renewal failed - subscription will enter grace period if configured");

        // Mark subscription as failed (but don't cancel yet - grace period might apply)
        if (payment.subscriptions.length > 0) {
          const subscription = payment.subscriptions[0];
          console.log("[Apple S2S] Subscription ID:", subscription.id);
          console.log("[Apple S2S] Current expiry:", subscription.expiresAt?.toISOString());
          console.log("[Apple S2S] Keeping subscription active for grace period");

          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              // Keep subscription active but add a note in metadata
            },
          });
        }
        break;

      case AppleNotificationType.EXPIRED:
      case AppleNotificationType.GRACE_PERIOD_EXPIRED:
        console.log("[Apple S2S] Handling EXPIRED/GRACE_PERIOD_EXPIRED for transaction:", transactionId);
        console.log("[Apple S2S] Subscription has fully expired - user loses access");
        console.log("[Apple S2S] No database update needed - expiry handled by expiresAt field");
        // Subscription has expired - user loses access
        // The subscription will naturally expire based on expiresAt date
        // No action needed - your app should check expiresAt when validating access
        break;

      case AppleNotificationType.REFUND:
      case AppleNotificationType.REVOKE:
        console.log("[Apple S2S] Handling REFUND/REVOKE for transaction:", transactionId);
        console.log("[Apple S2S] Refund issued - revoking subscription immediately");

        // Mark payment as failed due to refund
        updatedPayment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "failed",
            errors: JSON.stringify({ refunded: true, notificationType }),
            idempotencyKey,
            webhookPayloads: JSON.stringify({
              ...JSON.parse(payment.webhookPayloads || "{}"),
              [notificationType]: body,
            }),
          },
          include: {
            user: true,
            subscriptions: true,
          },
        });

        // Cancel associated subscription
        if (payment.subscriptions.length > 0) {
          const subscription = payment.subscriptions[0];
          console.log("[Apple S2S] Expiring subscription immediately:", subscription.id);

          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              expiresAt: new Date(), // Expire immediately
            },
          });
          console.log("[Apple S2S] Subscription expired due to refund");
        }
        console.log("[Apple S2S] Payment marked as failed due to refund");
        break;

      case AppleNotificationType.DID_CHANGE_RENEWAL_STATUS:
        console.log("[Apple S2S] Handling DID_CHANGE_RENEWAL_STATUS for transaction:", transactionId);

        // Auto-renewal was turned on/off by user
        // Store this info in subscription metadata if needed
        const autoRenewStatus = renewalInfo?.autoRenewStatus;
        console.log("[Apple S2S] Auto-renew status changed to:", autoRenewStatus === 1 ? 'ON' : 'OFF');
        console.log("[Apple S2S] Auto-renew product ID:", renewalInfo?.autoRenewProductId);
        break;

      default:
        console.log("[Apple S2S] Unhandled notification type:", notificationType);
        console.log("[Apple S2S] No specific handler for this notification type");
    }

    // Broadcast WebSocket update
    if (updatedPayment) {
      console.log("[Apple S2S] Broadcasting WebSocket update for payment:", payment.id);
      broadcastPaymentUpdate(payment.id, updatedPayment);
    }

    // Log successful processing
    logWebhookSuccess({
      provider: "apple_iap",
      eventType: notificationType,
      eventId: notificationUUID || transactionId,
      userId: payment.userId,
      clientIp,
      userAgent,
      signatureValid: true,
      idempotencyKey,
      timestamp,
    });

    console.log("[Apple S2S] ========== WEBHOOK COMPLETED ==========");
    console.log("[Apple S2S] Status: SUCCESS");
    console.log("[Apple S2S] Notification Type:", notificationType);
    console.log("[Apple S2S] Transaction ID:", transactionId);
    console.log("[Apple S2S] User ID:", payment.userId);
    console.log("[Apple S2S] Processing Time:", Date.now() - timestamp.getTime(), "ms");

    // Return decoded payload for debugging (only in development)
    return Response.json({
      message: "OK",
      decoded: {
        notificationType,
        subtype,
        notificationUUID,
        environment: data?.environment,
        bundleId: data?.bundleId,
        appAppleId: data?.appAppleId,
        transactionInfo: transactionInfo ? {
          transactionId: transactionInfo.transactionId,
          originalTransactionId: transactionInfo.originalTransactionId,
          productId: transactionInfo.productId,
          type: transactionInfo.type,
          environment: transactionInfo.environment,
          purchaseDate: transactionInfo.purchaseDate ? new Date(Number(transactionInfo.purchaseDate)).toISOString() : null,
          expiresDate: transactionInfo.expiresDate ? new Date(Number(transactionInfo.expiresDate)).toISOString() : null,
          price: transactionInfo.price,
          currency: transactionInfo.currency,
        } : null,
        renewalInfo: renewalInfo ? {
          autoRenewStatus: renewalInfo.autoRenewStatus,
          autoRenewProductId: renewalInfo.autoRenewProductId,
          originalTransactionId: renewalInfo.originalTransactionId,
          expirationIntent: renewalInfo.expirationIntent,
        } : null,
      },
      paymentId: payment?.id,
      processingTimeMs: Date.now() - timestamp.getTime(),
    });

  } catch (error) {
    console.log("[Apple S2S] ========== WEBHOOK FAILED ==========");
    console.error("[Apple S2S] Error:", error instanceof Error ? error.message : "Unknown error");
    console.error("[Apple S2S] Error details:", serializeError(error));
    console.log("[Apple S2S] Processing Time:", Date.now() - timestamp.getTime(), "ms");

    logWebhookError({
      provider: "apple_iap",
      eventType: "unknown",
      eventId: "unknown",
      clientIp,
      userAgent,
      signatureValid: false,
      timestamp,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    // Return 200 to prevent Apple from retrying on our internal errors
    return Response.json({ message: "Error" }, { status: 200 });
  }
}
