import IPaymentIntentMetaData from "@/interfaces/IPaymentIntentMetaData";
import IPaymentReceipt from "@/interfaces/IPaymentReceipt";
import { sendEmail } from "@/lib/mail";
import buildPaymentFailedEmail from "@/lib/mail/emails/buildPaymentFailedEmail";
import buildPurchaseReceiptEmail from "@/lib/mail/emails/buildPurchaseReceiptEmail";
import buildSubscriptionSuccessEmail from "@/lib/mail/emails/buildSubscriptionSuccessEmail";
import generatePaymentReceipt from "@/lib/payment-receipt/generatePaymentReceipt";
import prisma from "@/lib/prisma";
import {
  generatePaymentReference,
  generateSubscriptionReference,
} from "@/lib/referenceFactory";
import stripe, { formatStripeAmountIn } from "@/lib/stripe/stripe";
import { getStripeWebhook } from "@/lib/stripe/stripeWebhookSync";
import { sanitizeEmail, toSafeJSON } from "@/lib/utils/index";
import { fetchPurchaseRelatedProduct } from "@/lib/utils/purchaseUtils";
import { generateWebhookIdempotencyKey, checkIdempotencyKey } from "@/lib/utils/idempotencyUtils";
import { logWebhookSuccess, logWebhookSecurityViolation, logWebhookError, logWebhookDuplicate } from "@/lib/utils/webhookLogger";
import { schedulePaymentRetry, isPaymentRetryable } from "@/lib/utils/paymentRetryUtils";
import { broadcastPaymentUpdate } from "@/lib/websocket/paymentWebSocket";
import { markAsRecovered } from "@/lib/utils/abandonedSubscriptionTracker";
import { Currency, PurchaseEntityType } from "@prisma/client";
import moment from "moment";
import Mail from "nodemailer/lib/mailer";
import { serializeError } from "serialize-error";
import slugify from "slugify";
import Stripe from "stripe";

/**
 * @swagger
 * components:
 *   schemas:
 *     PaymentIntent:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: L'ID du paiement.
 *         status:
 *           type: string
 *           description: Le statut du paiement (succès ou échec).
 *         amount:
 *           type: integer
 *           description: Le montant payé.
 *         userId:
 *           type: string
 *           description: L'ID de l'utilisateur lié au paiement.
 *     Subscription:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: L'ID de l'abonnement.
 *         startDate:
 *           type: string
 *           format: date
 *           description: La date de début de l'abonnement.
 *         expirationDate:
 *           type: string
 *           format: date
 *           description: La date d'expiration de l'abonnement.
 * /webhook:
 *   post:
 *     summary: Gère les événements de paiement Stripe.
 *     description: Cette route écoute les événements Stripe tels que `payment_intent.succeeded` et `payment_intent.payment_failed` pour mettre à jour la base de données et envoyer des emails.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 description: Le type d'événement Stripe reçu.
 *               payload:
 *                 type: object
 *                 description: Le contenu du webhook Stripe.
 *     responses:
 *       200:
 *         description: Le webhook a été traité avec succès.
 *       400:
 *         description: Erreur dans la réception du webhook.
 *       500:
 *         description: Erreur serveur interne.
 */

export const dynamic = "force-dynamic";

// Handle OPTIONS for CORS preflight requests during testing
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, stripe-signature',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function POST(request: Request) {
  const timestamp = new Date();
  const clientIp = request.headers.get("x-forwarded-for")?.split(',')[0] || 
                   request.headers.get("x-real-ip") || 
                   "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  
  try {
    // extract request body as text
    const bodyText = await request.text();

    const sig = request.headers.get("stripe-signature");

    let event: Stripe.Event | null = null;

    try {
      // fetch the webhook
      const localWebhook = await getStripeWebhook();
      // construct the event
      event = stripe.webhooks.constructEvent(
        bodyText,
        sig ?? "",
        localWebhook.secret,
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", serializeError(err));
      
      // Log security violation
      logWebhookSecurityViolation({
        provider: "stripe",
        eventType: "unknown",
        clientIp,
        userAgent,
        signatureValid: false,
        timestamp,
        errorMessage: `Signature verification failed: ${(err as Error).message}`,
        requestHeaders: Object.fromEntries(request.headers.entries()),
      });
      
      if (process.env.NODE_ENV === "production") {
        // In production, always validate webhook signatures for security
        return Response.json(
          { 
            error: "Webhook signature verification failed",
            message: "Invalid webhook signature"
          }, 
          { 
            status: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization, stripe-signature',
            }
          }
        );
      } else {
        // Allow bypass only in development for testing
        console.warn("⚠️  DEVELOPMENT MODE: Bypassing webhook signature validation");
        try {
          event = JSON.parse(bodyText);
        } catch (parseErr) {
          console.error("Failed to parse webhook body as JSON:", parseErr);
          return Response.json(
            { error: "Invalid webhook payload" }, 
            { 
              status: 400,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, stripe-signature',
              }
            }
          );
        }
      }
    }

    if (event) {
      // Handle the event
      switch (event.type) {
        case "payment_intent.succeeded":
          {
            // get payment intent
            const paymentIntent = event.data.object;

            // extract meta data
            const meta = event.data.object.metadata as IPaymentIntentMetaData;

            // doesn't exist in test mode
            if (Object.keys(meta).length !== 0) {
              // Validate required metadata fields
              if (!meta.userId || !meta.product) {
                console.error(`Missing required metadata fields for payment intent ${paymentIntent.id}:`, {
                  userId: meta.userId,
                  product: meta.product
                });
                
                logWebhookError({
                  provider: "stripe",
                  eventType: event.type,
                  clientIp,
                  userAgent,
                  signatureValid: true,
                  timestamp,
                  errorMessage: "Missing required metadata fields",
                });
                
                return new Response(null, { status: 200 }); // Return success to avoid retries
              }

              // Validate that user exists
              const user = await prisma.user.findUnique({
                where: { id: meta.userId }
              });

              if (!user) {
                console.error(`User not found for payment intent ${paymentIntent.id}: ${meta.userId}`);
                
                logWebhookError({
                  provider: "stripe",
                  eventType: event.type,
                  clientIp,
                  userAgent,
                  signatureValid: true,
                  timestamp,
                  errorMessage: `User not found: ${meta.userId}`,
                });
                
                return new Response(null, { status: 200 }); // Return success to avoid retries
              }

              // For subscription products, validate that plan exists
              if (meta.product === 'subscription' && meta.planId) {
                const plan = await prisma.plan.findUnique({
                  where: { id: meta.planId, archivedAt: null }
                });

                if (!plan) {
                  console.error(`Plan not found for payment intent ${paymentIntent.id}: ${meta.planId}`);
                  
                  logWebhookError({
                    provider: "stripe",
                    eventType: event.type,
                    clientIp,
                    userAgent,
                    signatureValid: true,
                    timestamp,
                    errorMessage: `Plan not found: ${meta.planId}`,
                  });
                  
                  return new Response(null, { status: 200 }); // Return success to avoid retries
                }
              }
              
              // Generate idempotency key for this webhook event
              const idempotencyKey = generateWebhookIdempotencyKey(
                "stripe", 
                paymentIntent.id, 
                "payment_intent.succeeded"
              );

              // Check if payment already exists with this idempotency key
              const existingPayment = await checkIdempotencyKey(idempotencyKey);
              
              if (existingPayment) {
                console.log(`Payment already processed with idempotency key: ${idempotencyKey}`);
                
                // Log duplicate webhook attempt
                logWebhookDuplicate({
                  provider: "stripe",
                  eventType: event.type,
                  eventId: event.id,
                  userId: meta.userId,
                  clientIp,
                  userAgent,
                  signatureValid: true,
                  idempotencyKey,
                  timestamp,
                });
                
                return new Response(null, { 
                  status: 200,
                  headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, stripe-signature',
                  }
                });
              }

              // create the payment
              const payment = await prisma.payment.create({
                data: {
                  reference: await generatePaymentReference(meta.product),
                  userId: meta.userId,
                  externalId: paymentIntent.id,
                  idempotencyKey: idempotencyKey,
                  paidAmountCurrency: paymentIntent.currency as Currency,
                  receivedCurrency: paymentIntent.currency as Currency,
                  paidAmount: formatStripeAmountIn(
                    paymentIntent.amount,
                    paymentIntent.currency as Currency,
                  ),
                  receivedAmount: formatStripeAmountIn(
                    paymentIntent.amount_received,
                    paymentIntent.currency as Currency,
                  ),
                  status: "succeeded",
                  provider: "stripe",
                  providerPaymentMethod: "card",
                  webhookPayloads: JSON.stringify(paymentIntent),
                  meta: JSON.stringify(meta),
                  updatedAt: new Date(),
                  updatedById: meta.userId,
                },
              });

              // Broadcast payment success to WebSocket clients
              broadcastPaymentUpdate(payment.id, payment);

              switch (meta.product) {
                case "subscription":
                  {
                    const currentDate = moment();

                    // load subscription
                    const subscription = await prisma.subscription.create({
                      data: {
                        reference: await generateSubscriptionReference(),
                        planId: meta.planId,
                        period: meta.period,
                        userId: meta.userId,
                        paymentId: payment.id,
                        expiresAt: (() => {
                          switch (meta.period) {
                            case "month":
                              return currentDate.add(1, "month").toDate();

                            case "year":
                              return currentDate.add(1, "year").toDate();
                          }
                        })(),
                        updatedAt: new Date(),
                        updatedById: meta.userId,
                      },
                      include: {
                        user: true,
                        plan: true,
                        payment: true,
                      },
                    });

                    // Mark abandoned subscription as recovered
                    try {
                      await markAsRecovered(
                        null, // sessionId - pas disponible dans le webhook
                        meta.userId,
                        meta.planId,
                        subscription.id
                      );
                    } catch (recoveryError) {
                      console.error('Error marking abandoned subscription as recovered:', recoveryError);
                      // Ne pas bloquer le processus de webhook
                    }

                    /**
                     * User notification
                     * ------------------------------
                     * Send the email with the receipt as attachment
                     */

                    // attachments
                    const mailAttachments: Mail.Attachment[] = [];

                    if (subscription.payment) {
                      // create the receipt input
                      const receipt: IPaymentReceipt = {
                        currency: subscription.payment.paidAmountCurrency,
                        receiptNumber: subscription.payment.reference,
                        items: [
                          {
                            amount: subscription.payment.paidAmount.toNumber(),
                            description: `Abonnement ${subscription.plan.title} ${(() => {
                              switch (subscription.period) {
                                case "month":
                                  return "(M)";

                                case "year":
                                  return "(A)";
                              }
                            })()}`,
                            item: subscription.reference,
                            quantity: 1,
                          },
                        ],
                        paid: subscription.payment.paidAmount.toNumber(),
                        shipping: {
                          email: sanitizeEmail(subscription.user.email) ?? "",
                          name: subscription.user.name ?? "",
                        },
                        subtotal: subscription.payment.paidAmount.toNumber(),
                        date: subscription.createdAt,
                      };

                      // generate the receipt
                      const receiptBuffer =
                        await generatePaymentReceipt(receipt);

                      // generate the file name
                      const receiptFileName = slugify(
                        `receipt-${subscription.plan.title}-${subscription.payment.reference.replaceAll(".", "-")}.pdf`.toLowerCase(),
                      );

                      mailAttachments.push({
                        filename: receiptFileName,
                        content: receiptBuffer,
                        contentDisposition: "attachment",
                        contentType: "application/pdf",
                      });
                    }

                    // generate verification emails
                    const email =
                      await buildSubscriptionSuccessEmail(subscription);

                    // send email
                    await sendEmail(
                      {
                        to: subscription.user.email!,
                        subject: `Abonnement ${subscription.plan.title} activé`,
                        html: email.emailHtml,
                        text: email.emailText,
                        attachments: mailAttachments,
                      },
                      (err, info) => {
                        if (err) {
                          // failed to send the verification email
                          // error needs to be reported
                        } else {
                          // the email has been successfully sent.
                        }
                      },
                    );
                  }
                  break;

                case "post":
                case "packageFw":
                case "product":
                  {
                    const entityId = (() => {
                      switch (meta.product) {
                        case "post":
                          return Number(meta.postId);

                        case "product":
                          return Number(meta.productId);

                        case "packageFw":
                          return Number(meta.packageId);
                      }
                    })();

                    const entityType = ((): PurchaseEntityType => {
                      switch (meta.product) {
                        case "post":
                          return "post";

                        case "product":
                          return meta.entityType;

                        case "packageFw":
                          return "packagefw";
                      }
                    })();

                    // create the post purchase
                    const purchase = await prisma.purchase.create({
                      data: {
                        entityType,
                        paymentId: payment.id,
                        postId: entityId,
                        userId: meta.userId,
                        updatedAt: new Date(),
                        updatedById: meta.userId,
                      },
                      include: {
                        payment: true,
                        user: true,
                      },
                    });

                    const productData = await fetchPurchaseRelatedProduct(
                      purchase.entityType,
                      purchase.postId.toString(),
                    );

                    /**
                     * User notification
                     * ------------------------------
                     * Send the email with the receipt as attachment
                     */

                    // attachments
                    const mailAttachments: Mail.Attachment[] = [];

                    // create the receipt input
                    const receipt: IPaymentReceipt = {
                      currency: purchase.payment.paidAmountCurrency,
                      receiptNumber: purchase.payment.reference,
                      items: [
                        {
                          amount: purchase.payment.paidAmount.toNumber(),
                          item: purchase.payment.reference,
                          description: productData.data
                            ? `${productData.data.title}`
                            : productData.details.label,
                          quantity: 1,
                        },
                      ],
                      paid: purchase.payment.paidAmount.toNumber(),
                      shipping: {
                        email: sanitizeEmail(purchase.user.email) ?? "",
                        name: purchase.user.name ?? "",
                      },
                      subtotal: purchase.payment.paidAmount.toNumber(),
                      date: purchase.createdAt,
                    };

                    // generate the receipt
                    const receiptBuffer = await generatePaymentReceipt(receipt);

                    // generate the file name
                    const receiptFileName = slugify(
                      `receipt-${purchase.entityType}-${purchase.payment.reference.replaceAll(".", "-")}.pdf`.toLowerCase(),
                    );

                    mailAttachments.push({
                      filename: receiptFileName,
                      content: receiptBuffer,
                      contentDisposition: "attachment",
                      contentType: "application/pdf",
                    });

                    // generate verification emails
                    const email = await buildPurchaseReceiptEmail(purchase);

                    // send email
                    await sendEmail(
                      {
                        to: purchase.user.email!,
                        subject: email.emailSubject,
                        html: email.emailHtml,
                        text: email.emailText,
                        attachments: mailAttachments,
                      },
                      (err, info) => {
                        if (err) {
                          // failed to send the verification email
                          // error needs to be reported
                        } else {
                          // the email has been successfully sent.
                        }
                      },
                    );
                  }
                  break;

                default:
                  break;
              }
            }
          }
          break;
        case "payment_intent.payment_failed":
          {
            // get payment intent
            const paymentIntent = event.data.object;

            // extract meta data
            const meta = event.data.object.metadata as IPaymentIntentMetaData;

            // doesn't exist in test mode
            if (Object.keys(meta).length !== 0) {
              // Validate required metadata fields
              if (!meta.userId || !meta.product) {
                console.error(`Missing required metadata fields for failed payment intent ${paymentIntent.id}:`, {
                  userId: meta.userId,
                  product: meta.product
                });
                
                logWebhookError({
                  provider: "stripe",
                  eventType: event.type,
                  clientIp,
                  userAgent,
                  signatureValid: true,
                  timestamp,
                  errorMessage: "Missing required metadata fields for failed payment",
                });
                
                return new Response(null, { status: 200 }); // Return success to avoid retries
              }

              // Validate that user exists
              const user = await prisma.user.findUnique({
                where: { id: meta.userId }
              });

              if (!user) {
                console.error(`User not found for failed payment intent ${paymentIntent.id}: ${meta.userId}`);
                
                logWebhookError({
                  provider: "stripe",
                  eventType: event.type,
                  clientIp,
                  userAgent,
                  signatureValid: true,
                  timestamp,
                  errorMessage: `User not found for failed payment: ${meta.userId}`,
                });
                
                return new Response(null, { status: 200 }); // Return success to avoid retries
              }
              
              // Generate idempotency key for failed payment
              const idempotencyKey = generateWebhookIdempotencyKey(
                "stripe", 
                paymentIntent.id, 
                "payment_intent.payment_failed"
              );

              // Check if payment already exists with this idempotency key
              const existingPayment = await checkIdempotencyKey(idempotencyKey);
              
              if (existingPayment) {
                console.log(`Failed payment already processed with idempotency key: ${idempotencyKey}`);
                
                // Log duplicate webhook attempt for failed payment
                logWebhookDuplicate({
                  provider: "stripe",
                  eventType: event.type,
                  eventId: event.id,
                  userId: meta.userId,
                  clientIp,
                  userAgent,
                  signatureValid: true,
                  idempotencyKey,
                  timestamp,
                });
                
                return new Response(null, { 
                  status: 200,
                  headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, stripe-signature',
                  }
                });
              }

              // create the payment for monitoring purpose
              const payment = await prisma.payment.create({
                data: {
                  reference: await generatePaymentReference(meta.product),
                  userId: meta.userId,
                  externalId: paymentIntent.id,
                  idempotencyKey: idempotencyKey,
                  paidAmountCurrency: paymentIntent.currency as Currency,
                  receivedCurrency: paymentIntent.currency as Currency,
                  paidAmount: formatStripeAmountIn(
                    paymentIntent.amount,
                    paymentIntent.currency as Currency,
                  ),
                  receivedAmount: formatStripeAmountIn(
                    paymentIntent.amount_received,
                    paymentIntent.currency as Currency,
                  ),
                  status: "failed",
                  provider: "stripe",
                  providerPaymentMethod: "card",
                  webhookPayloads: JSON.stringify(paymentIntent),
                  meta: JSON.stringify(meta),
                  updatedAt: new Date(),
                  updatedById: meta.userId,
                },
                include: {
                  user: true,
                },
              });

              // Broadcast payment failure to WebSocket clients
              broadcastPaymentUpdate(payment.id, payment);

              /**
               * User notification
               * ------------------------------
               *
               */

              // generate verification emails
              const email = await buildPaymentFailedEmail(payment);

              // Check if payment should be retried
              if (isPaymentRetryable(payment, 0)) {
                try {
                  await schedulePaymentRetry(
                    payment.id, 
                    1, 
                    `Stripe payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`
                  );
                  console.log(`Scheduled retry for failed payment: ${payment.id}`);
                } catch (retryError) {
                  console.error(`Failed to schedule retry for payment ${payment.id}:`, retryError);
                }
              }

              // send email
              await sendEmail(
                {
                  to: payment.user.email!,
                  subject: email.emailSubject,
                  html: email.emailHtml,
                  text: email.emailText,
                },
                (err, info) => {
                  if (err) {
                    // failed to send the verification email
                    // error needs to be reported
                  } else {
                    // the email has been successfully sent.
                  }
                },
              );
            }
          }
          break;
      }
    } else {
      throw {
        message: "Webbook event object missing.",
      };
    }

    // Log successful webhook processing
    if (event) {
      logWebhookSuccess({
        provider: "stripe",
        eventType: event.type,
        eventId: event.id,
        clientIp,
        userAgent,
        signatureValid: true,
        timestamp,
      });
    }

    return new Response(null, { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, stripe-signature',
      }
    });
  } catch (error) {
    console.log("webhook serialized error", serializeError(error));
    
    // Log webhook processing error
    logWebhookError({
      provider: "stripe",
      eventType: "unknown",
      clientIp,
      userAgent,
      signatureValid: false,
      timestamp,
      errorMessage: (error as Error).message,
    });
    
    return Response.json(serializeError(error), { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, stripe-signature',
      }
    });
  }
}
