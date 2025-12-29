// /app/api/webhooks/mycoolpay/route.ts
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { serializeError } from "serialize-error";
import { applyPaymentResult } from "@/lib/utils/paymentUtils";
import { generateWebhookIdempotencyKey, checkIdempotencyKey } from "@/lib/utils/idempotencyUtils";
import { logWebhookSuccess, logWebhookSecurityViolation, logWebhookError, logWebhookDuplicate } from "@/lib/utils/webhookLogger";
import { schedulePaymentRetry, isPaymentRetryable } from "@/lib/utils/paymentRetryUtils";
import { broadcastPaymentUpdate } from "@/lib/websocket/paymentWebSocket";

export async function POST(req: NextRequest) {
  const timestamp = new Date();
  const clientIp = req.headers.get("x-forwarded-for")?.split(',')[0] || 
                   req.headers.get("x-real-ip") || 
                   "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  
  try {
    const body = await req.json();

    const {
      transaction_ref,
      transaction_type,
      transaction_amount,
      transaction_currency,
      transaction_operator,
      transaction_status,
      app_transaction_ref,
      signature,
    } = body;

    const privateKey = process.env.MYCOOLPAY_SECRET_KEY;

    // 💡 Recréer la signature à partir des valeurs reçues
    const rawSignature = transaction_ref +
      transaction_type +
      transaction_amount +
      transaction_currency +
      transaction_operator +
      privateKey;

    const expectedSignature = crypto
      .createHash("md5")
      .update(rawSignature)
      .digest("hex");

    if (signature !== expectedSignature) {
      // Log security violation
      logWebhookSecurityViolation({
        provider: "mycoolpay",
        eventType: transaction_type || "unknown",
        clientIp,
        userAgent,
        signatureValid: false,
        timestamp,
        errorMessage: "MyCoolPay signature verification failed",
        requestHeaders: Object.fromEntries(req.headers.entries()),
      });
      
      return Response.json({ message: "Invalid signature" }, { status: 403 });
    }

    // Generate idempotency key for this webhook event
    const idempotencyKey = generateWebhookIdempotencyKey(
      "mycoolpay", 
      transaction_ref, 
      transaction_status
    );

    // Check if this webhook was already processed
    const existingProcessing = await checkIdempotencyKey(idempotencyKey);
    
    if (existingProcessing) {
      console.log(`MyCoolPay webhook already processed with idempotency key: ${idempotencyKey}`);
      
      // Log duplicate webhook attempt
      logWebhookDuplicate({
        provider: "mycoolpay",
        eventType: transaction_status,
        eventId: transaction_ref,
        clientIp,
        userAgent,
        signatureValid: true,
        idempotencyKey,
        timestamp,
      });
      
      return Response.json({ message: "OK" });
    }

    // Vérifie que le paiement existe
    const payment = await prisma.payment.findUnique({
      where: {
        reference: app_transaction_ref,
      },
      include: {
        user: true,
      },
    });

    if (!payment) {
      // Log error for unknown payment
      logWebhookError({
        provider: "mycoolpay",
        eventType: transaction_status,
        eventId: transaction_ref,
        clientIp,
        userAgent,
        signatureValid: true,
        timestamp,
        errorMessage: `Payment not found for reference: ${app_transaction_ref}`,
      });
      
      return Response.json({ message: "Payment not found" }, { status: 404 });
    }

    // Determine new status and update payment
    let newStatus: string;
    let updatedPayment;

    if (transaction_status === "SUCCESS") {
      newStatus = "succeeded";
      updatedPayment = await prisma.payment.update({
        where: {
          reference: app_transaction_ref,
        },
        data: {
          status: "succeeded",
          receivedAmount: transaction_amount,
          receivedCurrency: transaction_currency.toLowerCase(),
          idempotencyKey: idempotencyKey,
          updatedAt: new Date(),
        },
        include: {
          user: true,
        },
      });
      
      // Broadcast WebSocket update
      broadcastPaymentUpdate(payment.id, updatedPayment);
      
      // Apply payment result (send emails, create subscriptions, etc.)
      await applyPaymentResult(updatedPayment);
      
    } else if (transaction_status === "FAILED" || transaction_status === "CANCELED") {
      newStatus = "failed";
      updatedPayment = await prisma.payment.update({
        where: {
          reference: app_transaction_ref,
        },
        data: {
          status: "failed",
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
      if (isPaymentRetryable(updatedPayment, 0)) {
        try {
          await schedulePaymentRetry(
            updatedPayment.id, 
            1, 
            `MyCoolPay payment failed: ${transaction_status}`
          );
          console.log(`Scheduled retry for failed MyCoolPay payment: ${updatedPayment.id}`);
        } catch (retryError) {
          console.error(`Failed to schedule retry for MyCoolPay payment ${updatedPayment.id}:`, retryError);
        }
      }

      // Apply payment result
      await applyPaymentResult(updatedPayment);
    }

    // Log successful webhook processing
    if (updatedPayment) {
      logWebhookSuccess({
        provider: "mycoolpay",
        eventType: transaction_status,
        eventId: transaction_ref,
        userId: payment.userId,
        clientIp,
        userAgent,
        signatureValid: true,
        idempotencyKey,
        timestamp,
      });
    }

    return Response.json({ message: "OK" });
  } catch (error) {
    console.error("MyCoolPay webhook error:", serializeError(error));
    
    // Log webhook processing error
    logWebhookError({
      provider: "mycoolpay",
      eventType: "unknown",
      clientIp,
      userAgent,
      signatureValid: false,
      timestamp,
      errorMessage: (error as Error).message,
    });
    
    return Response.json({ message: "Internal error" }, { status: 500 });
  }
}
