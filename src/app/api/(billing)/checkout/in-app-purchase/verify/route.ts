/**
 * In-App Purchase Verification Endpoint (iOS Only)
 *
 * POST /api/checkout/in-app-purchase/verify
 *
 * Verifies Apple App Store receipts
 * Creates payment record and grants subscriptions/purchases
 *
 * Note: Google Play Store verification is disabled
 */

import { NextRequest } from "next/server";
import authMiddleware from "@/lib/auth/authMiddleware";
import prisma from "@/lib/prisma";
import { generatePaymentReference } from "@/lib/referenceFactory";
import { applyPaymentResult, PAYMENT_PUBLIC_SELECT_INPUT } from "@/lib/utils/paymentUtils";
import {
  verifyAppleReceipt,
  mapAppleProductToPlan,
} from "@/lib/iap/verification";
import { Currency } from "@prisma/client";
import { serializeError } from "serialize-error";
import { z } from "zod";
import { broadcastPaymentUpdate } from "@/lib/websocket/paymentWebSocket";

export const dynamic = "force-dynamic";

// Request validation schema
const verifyRequestSchema = z.object({
  platform: z.enum(["ios"]), // Only iOS supported
  receiptData: z.string().min(1, "Receipt data is required"),
  productId: z.string().min(1, "Product ID is required"),
  transactionId: z.string().min(1, "Transaction ID is required"),
  purchaseDate: z.string().optional(),
});

/**
 * POST /api/checkout/in-app-purchase/verify
 *
 * Verify In-App Purchase receipt and create subscription
 */
export async function POST(req: NextRequest) {
  console.log("[IAP Verify] ========== ENDPOINT CALLED ==========");
  console.log("[IAP Verify] Timestamp:", new Date().toISOString());
  console.log("[IAP Verify] Has Authorization header:", !!req.headers.get("authorization"));

  return authMiddleware(req, async (user) => {
    const timestamp = new Date();
    const clientIp = req.headers.get("x-forwarded-for")?.split(',')[0] ||
                     req.headers.get("x-real-ip") ||
                     "unknown";

    console.log("[IAP Verify] ========== AUTH PASSED ==========");
    console.log("[IAP Verify] User ID:", user.id);
    console.log("[IAP Verify] User Email:", user.email);
    console.log("[IAP Verify] Client IP:", clientIp);

    try {
      // Parse and validate request body
      const body = await req.json();

      console.log("[IAP Verify] ========== REQUEST DATA ==========");
      console.log("[IAP Verify] Platform:", body.platform);
      console.log("[IAP Verify] Product ID:", body.productId);
      console.log("[IAP Verify] Transaction ID:", body.transactionId);
      console.log("[IAP Verify] Purchase Date:", body.purchaseDate);
      console.log("[IAP Verify] Receipt Data length:", body.receiptData?.length || 0);
      console.log("[IAP Verify] Receipt Data preview:", body.receiptData ? `${body.receiptData.substring(0, 50)}...` : "N/A");

      const validatedData = verifyRequestSchema.parse(body);

      console.log("[IAP Verify] Request validation passed");

      // ========== DUPLICATE PREVENTION ==========
      // Check for duplicate transaction by multiple criteria
      console.log("[IAP Verify] ========== CHECKING FOR DUPLICATES ==========");

      // 1. Check by transaction ID (primary check)
      const existingByTransactionId = await prisma.payment.findFirst({
        where: {
          externalId: validatedData.transactionId,
          provider: "apple_iap",
        },
        include: {
          user: true,
        },
      });

      if (existingByTransactionId) {
        console.log("[IAP Verify] ⚠️ DUPLICATE: Transaction ID already exists");
        console.log("[IAP Verify] Transaction ID:", validatedData.transactionId);
        console.log("[IAP Verify] Existing payment ID:", existingByTransactionId.id);
        console.log("[IAP Verify] Existing payment user:", existingByTransactionId.user?.email);
        console.log("[IAP Verify] Current request user:", user.email);

        // Check if it belongs to the same user
        if (existingByTransactionId.userId === user.id) {
          return Response.json({
            success: true,
            message: "Transaction already processed for this user",
            payment: existingByTransactionId,
            duplicate: true,
          });
        } else {
          // Different user trying to use same transaction - potential fraud
          console.error("[IAP Verify] ⛔ FRAUD ALERT: Different user attempting to use existing transaction!");
          return Response.json({
            success: false,
            error: "This transaction has already been used",
            duplicate: true,
          }, { status: 400 });
        }
      }

      // 2. Check for recent pending payments from same user for same product (prevent double-tap)
      const recentPendingPayment = await prisma.payment.findFirst({
        where: {
          userId: user.id,
          provider: "apple_iap",
          createdAt: {
            gte: new Date(Date.now() - 60000), // Within last 60 seconds
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (recentPendingPayment) {
        console.log("[IAP Verify] ⚠️ Recent payment found within 60 seconds");
        console.log("[IAP Verify] Recent payment ID:", recentPendingPayment.id);
        console.log("[IAP Verify] Recent payment created:", recentPendingPayment.createdAt);

        // Check if it's the exact same transaction (based on external ID)
        if (recentPendingPayment.externalId === validatedData.transactionId) {
          return Response.json({
            success: true,
            message: "Transaction already being processed",
            payment: recentPendingPayment,
            duplicate: true,
          });
        }
      }

      console.log("[IAP Verify] ✅ No duplicates found, proceeding with verification");

      // Verify receipt with Apple App Store
      console.log("[IAP Verify] ========== APPLE RECEIPT VERIFICATION ==========");
      console.log("[IAP Verify] Calling verifyAppleReceipt...");
      const verificationResult = await verifyAppleReceipt(validatedData.receiptData);
      const planMapping = mapAppleProductToPlan(validatedData.productId);

      console.log("[IAP Verify] Verification result:");
      console.log("[IAP Verify]   - Valid:", verificationResult.valid);
      console.log("[IAP Verify]   - Transaction ID:", verificationResult.transactionId);
      console.log("[IAP Verify]   - Product ID:", verificationResult.productId);
      console.log("[IAP Verify]   - Environment:", verificationResult.environment);
      console.log("[IAP Verify]   - Status:", verificationResult.status);
      console.log("[IAP Verify]   - Error:", verificationResult.error || "None");

      console.log("[IAP Verify] Plan mapping:");
      console.log("[IAP Verify]   - Plan ID:", planMapping.planId);
      console.log("[IAP Verify]   - Period:", planMapping.period);

      // Check if receipt is valid
      if (!verificationResult.valid) {
        console.log("[IAP Verify] ERROR: Invalid receipt");
        console.error("[IAP Verify] Receipt validation failed:", verificationResult.error);

        return Response.json(
          {
            success: false,
            error: verificationResult.error || "Invalid receipt",
            status: verificationResult.status,
          },
          { status: 400 }
        );
      }

      console.log("[IAP Verify] Receipt verified successfully");

      // Get plan from database if this is a subscription
      console.log("[IAP Verify] ========== PLAN LOOKUP ==========");
      let plan = null;
      if (planMapping.planId) {
        console.log("[IAP Verify] Looking up plan:", planMapping.planId);
        plan = await prisma.plan.findFirst({
          where: {
            planType: planMapping.planId,
            archivedAt: null,
          },
        });

        if (!plan) {
          console.log("[IAP Verify] ERROR: Plan not found:", planMapping.planId);
          return Response.json(
            {
              success: false,
              error: `Plan not found: ${planMapping.planId}`,
            },
            { status: 400 }
          );
        }
        console.log("[IAP Verify] Plan found:", plan.id, "-", plan.planType);
      } else {
        console.log("[IAP Verify] No plan mapping - this is a one-time purchase");
      }

      // Determine amount and currency
      const amount = verificationResult.amount || (plan
        ? (planMapping.period === 'year' ? Number(plan.yearlyPrice) : Number(plan.monthlyPrice))
        : 0);
      const currency = (verificationResult.currency || plan?.amountCurrency || 'usd').toLowerCase() as Currency;

      // Create payment metadata
      // IMPORTANT: planId must be the database plan ID (not planType)
      // The subscription.create uses planId to reference the Plan table
      const meta = plan
        ? {
            userId: user.id,
            product: "subscription" as const,
            planId: plan.id, // Use actual database plan ID, not planType
            period: planMapping.period || "year" as const,
          }
        : {
            userId: user.id,
            product: "post" as const,
            postId: validatedData.productId, // For non-subscription IAP
          };

      // Generate payment reference
      const paymentReference = await generatePaymentReference(meta.product);

      console.log("[IAP Verify] ========== CREATING PAYMENT ==========");
      console.log("[IAP Verify] Payment reference:", paymentReference);
      console.log("[IAP Verify] Amount:", amount, currency);
      console.log("[IAP Verify] Meta:", JSON.stringify(meta, null, 2));

      // Create payment record with race condition protection
      let payment;
      try {
        payment = await prisma.payment.create({
          data: {
            reference: paymentReference,
            userId: user.id,
            externalId: validatedData.transactionId,
            provider: "apple_iap",
            providerPaymentMethod: "in_app_purchase",
            paidAmount: amount,
            paidAmountCurrency: currency,
            receivedAmount: amount,
            receivedCurrency: currency,
            status: "succeeded",
            meta: JSON.stringify(meta),
            webhookPayloads: JSON.stringify({
              verificationResult,
              originalRequest: validatedData,
              timestamp: timestamp.toISOString(),
              clientIp,
            }),
            updatedAt: timestamp,
            updatedById: user.id,
          },
          select: PAYMENT_PUBLIC_SELECT_INPUT,
        });
      } catch (createError: any) {
        // Handle unique constraint violation (race condition - duplicate request)
        if (createError?.code === 'P2002') {
          console.log("[IAP Verify] ⚠️ Race condition detected - payment already created");

          // Fetch the existing payment
          const existingPayment = await prisma.payment.findFirst({
            where: {
              externalId: validatedData.transactionId,
              provider: "apple_iap",
            },
            include: { user: true },
          });

          if (existingPayment) {
            return Response.json({
              success: true,
              message: "Transaction already processed (race condition)",
              payment: existingPayment,
              duplicate: true,
            });
          }
        }
        throw createError;
      }

      console.log("[IAP Verify] Payment created successfully");
      console.log("[IAP Verify] Payment ID:", payment.id);

      // Fetch full payment with user for broadcasting and processing
      const fullPayment = await prisma.payment.findUnique({
        where: { id: payment.id },
        include: { user: true },
      });

      if (!fullPayment) {
        throw new Error("Failed to fetch payment after creation");
      }

      // Broadcast WebSocket update
      console.log("[IAP Verify] Broadcasting WebSocket update...");
      broadcastPaymentUpdate(fullPayment.id, fullPayment);

      // Apply payment result (create subscription/purchase, send emails)
      console.log("[IAP Verify] Applying payment result (subscription/emails)...");
      await applyPaymentResult(fullPayment);

      console.log("[IAP Verify] ========== SUCCESS ==========");
      console.log("[IAP Verify] User:", user.id, "-", user.email);
      console.log("[IAP Verify] Payment ID:", payment.id);
      console.log("[IAP Verify] Transaction ID:", validatedData.transactionId);
      console.log("[IAP Verify] Product:", validatedData.productId);

      return Response.json({
        success: true,
        payment,
        message: "Receipt verified and purchase processed",
      });

    } catch (error) {
      console.log("[IAP Verify] ========== ERROR ==========");
      console.error("[IAP Verify] Error:", error instanceof Error ? error.message : "Unknown error");
      console.error("[IAP Verify] Error details:", serializeError(error));

      // Handle validation errors
      if (error instanceof z.ZodError) {
        console.log("[IAP Verify] Validation error:", JSON.stringify(error.errors, null, 2));
        return Response.json(
          {
            success: false,
            error: "Invalid request data",
            details: error.errors,
          },
          { status: 400 }
        );
      }

      // Handle other errors
      return Response.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Verification failed",
        },
        { status: 500 }
      );
    }
  });
}
