import IFlutterwaveWebhookPayload from "@/interfaces/IFlutterwaveWebhookPayload";
import IPaymentIntentMetaData from "@/interfaces/IPaymentIntentMetaData";
import prisma from "@/lib/prisma";
import { applyPaymentResult } from "@/lib/utils/paymentUtils";
import { generateWebhookIdempotencyKey, checkIdempotencyKey } from "@/lib/utils/idempotencyUtils";
import { logWebhookSuccess, logWebhookSecurityViolation, logWebhookError, logWebhookDuplicate } from "@/lib/utils/webhookLogger";
import { schedulePaymentRetry, isPaymentRetryable } from "@/lib/utils/paymentRetryUtils";
import { broadcastPaymentUpdate } from "@/lib/websocket/paymentWebSocket";
import { serializeError } from "serialize-error";

/**
 * @swagger
 * /flutterwave/webhook:
 *   post:
 *     summary: Traiter un webhook de Flutterwave
 *     description: Cette route reçoit les événements de paiement de Flutterwave et met à jour l'état du paiement dans la base de données en fonction du statut retourné par Flutterwave.
 *     operationId: handleFlutterwaveWebhook
 *     tags:
 *       - Webhook
 *     requestBody:
 *       description: Le corps de la requête contient un événement de paiement de Flutterwave.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 description: Les données de l'événement de paiement.
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: L'ID unique de l'événement.
 *                   status:
 *                     type: string
 *                     description: Le statut du paiement (par exemple, "pending", "successful", "failed").
 *             required:
 *               - data
 *     responses:
 *       '200':
 *         description: L'événement webhook a été traité avec succès.
 *       '400':
 *         description: La requête est invalide ou le secret de vérification a échoué.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message détaillant l'erreur (ex. "Verification failed").
 *       '500':
 *         description: Une erreur interne s'est produite lors du traitement du webhook.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message d'erreur détaillé.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const timestamp = new Date();
  const clientIp = request.headers.get("x-forwarded-for")?.split(',')[0] || 
                   request.headers.get("x-real-ip") || 
                   "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  
  try {
    // extract request body as text
    const bodyText = await request.text();

    let event: IFlutterwaveWebhookPayload | null = null;

    try {
      // Check for the signature
      const secretHash = process.env.FLW_SECRET_HASH;
      const signature = request.headers.get("verif-hash");
      
      if (!signature || signature !== secretHash) {
        // Log security violation
        logWebhookSecurityViolation({
          provider: "flutterwave",
          eventType: "unknown",
          clientIp,
          userAgent,
          signatureValid: false,
          timestamp,
          errorMessage: "Flutterwave signature verification failed",
          requestHeaders: Object.fromEntries(request.headers.entries()),
        });
        
        return Response.json(
          {
            message: "Verification failed.",
          },
          { status: 401 },
        );
      }
      
      // Parse event after signature verification
      event = JSON.parse(bodyText);
    } catch (err) {
      console.error("Flutterwave webhook verification failed:", serializeError(err));
      
      if (process.env.NODE_ENV === "production") {
        // Log security violation in production
        logWebhookSecurityViolation({
          provider: "flutterwave",
          eventType: "unknown",
          clientIp,
          userAgent,
          signatureValid: false,
          timestamp,
          errorMessage: `Flutterwave webhook verification failed: ${(err as Error).message}`,
          requestHeaders: Object.fromEntries(request.headers.entries()),
        });
        
        return Response.json(
          { message: "Webhook verification failed" },
          { status: 400 }
        );
      } else {
        // Allow bypass only in development for testing
        console.warn("⚠️  DEVELOPMENT MODE: Bypassing Flutterwave webhook verification");
        try {
          event = JSON.parse(bodyText);
        } catch (parseErr) {
          console.error("Failed to parse Flutterwave webhook body as JSON:", parseErr);
          return Response.json(
            { error: "Invalid webhook payload" }, 
            { status: 400 }
          );
        }
      }
    }

    if (event) {
      // Generate idempotency key for this webhook event
      const idempotencyKey = generateWebhookIdempotencyKey(
        "flutterwave", 
        `${event.data.id}`, 
        `status_${event.data.status}`
      );

      // Check if this webhook was already processed
      const existingProcessing = await checkIdempotencyKey(idempotencyKey);
      
      if (existingProcessing) {
        console.log(`Flutterwave webhook already processed with idempotency key: ${idempotencyKey}`);
        
        // Log duplicate webhook attempt
        logWebhookDuplicate({
          provider: "flutterwave",
          eventType: `status_${event.data.status}`,
          eventId: `${event.data.id}`,
          clientIp,
          userAgent,
          signatureValid: true,
          idempotencyKey,
          timestamp,
        });
        
        return new Response(undefined, { status: 200 });
      }

      // Load the related payment
      let payment = await prisma.payment.findFirst({
        where: {
          externalId: `${event.data.id}`,
        },
        include: {
          user: true,
        },
      });

      if (payment) {
        // Determine new status
        const newStatus = (() => {
          switch (event.data.status) {
            case "pending":
              return "processing";
            case "successful":
              return "succeeded";
            default:
              return "failed";
          }
        })();

        // Update payment with idempotency key
        const updatedPayment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: newStatus,
            idempotencyKey: idempotencyKey,
            updatedAt: new Date(),
          },
          include: {
            user: true,
          },
        });

        // Broadcast WebSocket update
        broadcastPaymentUpdate(payment.id, updatedPayment);

        // Handle retry logic for failed payments
        if (newStatus === "failed" && isPaymentRetryable(updatedPayment, 0)) {
          try {
            await schedulePaymentRetry(
              updatedPayment.id, 
              1, 
              `Flutterwave payment failed: ${event.data.status}`
            );
            console.log(`Scheduled retry for failed Flutterwave payment: ${updatedPayment.id}`);
          } catch (retryError) {
            console.error(`Failed to schedule retry for Flutterwave payment ${updatedPayment.id}:`, retryError);
          }
        }

        // Apply payment result (send emails, create subscriptions, etc.)
        await applyPaymentResult(updatedPayment);

        // Log successful webhook processing
        logWebhookSuccess({
          provider: "flutterwave",
          eventType: `status_${event.data.status}`,
          eventId: `${event.data.id}`,
          userId: payment.userId,
          clientIp,
          userAgent,
          signatureValid: true,
          idempotencyKey,
          timestamp,
        });
      } else {
        console.warn(`Flutterwave webhook received for unknown payment: ${event.data.id}`);
        
        // Log warning for unknown payment
        logWebhookError({
          provider: "flutterwave",
          eventType: `status_${event.data.status}`,
          eventId: `${event.data.id}`,
          clientIp,
          userAgent,
          signatureValid: true,
          timestamp,
          errorMessage: `Payment not found for external ID: ${event.data.id}`,
        });
      }
    } else {
      throw {
        message: "Webbook event object missing.",
      };
    }

    return new Response(undefined, { status: 200 });
  } catch (error) {
    console.error("Flutterwave webhook serialized error", serializeError(error));
    
    // Log webhook processing error
    logWebhookError({
      provider: "flutterwave",
      eventType: "unknown",
      clientIp,
      userAgent,
      signatureValid: false,
      timestamp,
      errorMessage: (error as Error).message,
    });
    
    return Response.json(serializeError(error), { status: 500 });
  }
}
