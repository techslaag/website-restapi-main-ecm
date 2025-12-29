import crypto from "crypto";
import prisma from "@/lib/prisma";
import { type Prisma } from "@prisma/client";

/**
 * Generates a unique idempotency key for payment operations
 * Format: {userId}_{productType}_{productId}_{timestamp}_{random}
 */
export function generateIdempotencyKey(
  userId: string,
  productType: string,
  productId: string,
  additionalData?: string
): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  const baseKey = `${userId}_${productType}_${productId}_${timestamp}_${random}`;
  
  // Include additional data if provided (e.g., period for subscriptions)
  if (additionalData) {
    return `${baseKey}_${additionalData}`;
  }
  
  return baseKey;
}

/**
 * Checks if a payment with the given idempotency key already exists
 * Returns the existing payment if found, null otherwise
 */
export async function checkIdempotencyKey(idempotencyKey: string) {
  try {
    const existingPayment = await prisma.payment.findUnique({
      where: { 
        idempotencyKey 
      } as Prisma.PaymentWhereUniqueInput,
      include: {
        user: true,
        subscriptions: true,
        purchases: true
      }
    });
    
    return existingPayment;
  } catch (error) {
    console.error("Error checking idempotency key:", error);
    return null;
  }
}

/**
 * Validates that an idempotency key has the correct format
 */
export function validateIdempotencyKey(key: string): boolean {
  // Basic validation: should have at least 5 parts separated by underscores
  const parts = key.split("_");
  return parts.length >= 5 && parts.every(part => part.length > 0);
}

/**
 * Creates a hash-based idempotency key for webhook events
 * This ensures the same webhook payload always generates the same key
 */
export function generateWebhookIdempotencyKey(
  provider: string,
  externalId: string,
  eventType: string
): string {
  const data = `${provider}_${externalId}_${eventType}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}