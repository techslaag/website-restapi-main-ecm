import prisma from "@/lib/prisma";
import { Payment, PaymentStatus, PaymentProviderName } from "@prisma/client";
import { sendEmail } from "@/lib/mail";
import { getProviderConfig, isErrorRetryable } from "@/lib/config/paymentProviders";

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatuses: PaymentStatus[];
  retryableProviders: PaymentProviderName[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 30000, // 30 seconds
  maxDelayMs: 3600000, // 1 hour
  backoffMultiplier: 2,
  retryableStatuses: ['failed', 'processing'],
  retryableProviders: ['stripe', 'flutterwave', 'mycoolpay'] as PaymentProviderName[],
};

/**
 * Calculates the delay for the next retry attempt using exponential backoff
 */
export function calculateRetryDelay(attemptNumber: number, config: RetryConfig): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attemptNumber - 1);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Checks if a payment is eligible for retry
 */
export function isPaymentRetryable(
  payment: Payment, 
  currentRetryCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): boolean {
  try {
    // Get provider-specific configuration
    const providerConfig = getProviderConfig(payment.provider);
    
    // Check if provider supports retry
    if (!providerConfig.retryConfig.enabled) {
      return false;
    }
    
    // Check if payment status is retryable
    if (!config.retryableStatuses.includes(payment.status)) {
      return false;
    }

    // Use provider-specific max retries if available
    const maxRetries = providerConfig.retryConfig.maxRetries || config.maxRetries;
    if (currentRetryCount >= maxRetries) {
      return false;
    }

    // Check payment age (don't retry very old payments)
    const paymentAge = Date.now() - payment.createdAt.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (paymentAge > maxAge) {
      return false;
    }

    return true;
  } catch (error) {
    // Fallback to original logic if provider config fails
    console.warn(`Failed to get provider config for ${payment.provider}, using fallback:`, error);
    return (
      config.retryableStatuses.includes(payment.status) &&
      config.retryableProviders.includes(payment.provider) &&
      currentRetryCount < config.maxRetries &&
      (Date.now() - payment.createdAt.getTime()) < 24 * 60 * 60 * 1000
    );
  }
}

/**
 * Creates a payment retry record
 */
export async function schedulePaymentRetry(
  paymentId: string,
  retryAttempt: number,
  reason: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
) {
  const delay = calculateRetryDelay(retryAttempt, config);
  const scheduleTime = new Date(Date.now() + delay);

  // Store retry information in payment meta
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId }
  });

  if (!payment) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  const currentMeta = payment.meta ? JSON.parse(payment.meta) : {};
  const retryMeta = {
    ...currentMeta,
    retryInfo: {
      attempt: retryAttempt,
      scheduledFor: scheduleTime.toISOString(),
      reason,
      lastRetryAt: new Date().toISOString(),
    }
  };

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      meta: JSON.stringify(retryMeta),
      updatedAt: new Date(),
    }
  });

  console.log(`Payment retry scheduled: ${paymentId}, attempt ${retryAttempt}, scheduled for ${scheduleTime.toISOString()}`);
  
  return scheduleTime;
}

/**
 * Gets payments that are due for retry
 */
export async function getPaymentsDueForRetry(): Promise<Payment[]> {
  const now = new Date();
  
  // Find payments that need retry
  const payments = await prisma.payment.findMany({
    where: {
      status: { in: DEFAULT_RETRY_CONFIG.retryableStatuses },
      provider: { in: DEFAULT_RETRY_CONFIG.retryableProviders },
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    },
    include: {
      user: true
    }
  });

  // Filter payments that are due for retry
  return payments.filter(payment => {
    if (!payment.meta) return false;
    
    try {
      const meta = JSON.parse(payment.meta);
      const retryInfo = meta.retryInfo;
      
      if (!retryInfo || !retryInfo.scheduledFor) return false;
      
      const scheduledTime = new Date(retryInfo.scheduledFor);
      return scheduledTime <= now && retryInfo.attempt <= DEFAULT_RETRY_CONFIG.maxRetries;
    } catch {
      return false;
    }
  });
}

/**
 * Processes a payment retry
 */
export async function processPaymentRetry(payment: Payment): Promise<boolean> {
  try {
    const meta = payment.meta ? JSON.parse(payment.meta) : {};
    const retryInfo = meta.retryInfo || { attempt: 0 };
    const nextAttempt = retryInfo.attempt + 1;

    console.log(`Processing payment retry: ${payment.id}, attempt ${nextAttempt}`);

    // Check if still retryable
    if (!isPaymentRetryable(payment, nextAttempt)) {
      await markPaymentRetryExhausted(payment.id);
      return false;
    }

    // Based on provider, trigger retry
    switch (payment.provider) {
      case 'stripe':
        return await retryStripePayment(payment, nextAttempt);
      case 'flutterwave':
        return await retryFlutterwavePayment(payment, nextAttempt);
      case 'mycoolpay':
        return await retryMyCoolPayPayment(payment, nextAttempt);
      default:
        console.warn(`Retry not implemented for provider: ${payment.provider}`);
        return false;
    }
  } catch (error) {
    console.error(`Error processing payment retry for ${payment.id}:`, error);
    return false;
  }
}

/**
 * Retry Stripe payment
 */
async function retryStripePayment(payment: Payment, attemptNumber: number): Promise<boolean> {
  console.log(`Retrying Stripe payment ${payment.externalId}, attempt ${attemptNumber}`);
  
  try {
    // Import Stripe dynamically to avoid issues
    const { default: stripe } = await import('@/lib/stripe/stripe');
    
    // Fetch the latest payment intent status from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment.externalId);
    
    // Check if the payment intent status has changed
    if (paymentIntent.status === 'succeeded') {
      // Payment succeeded externally, update our database
      await prisma.payment.update({
        where: { id: payment.id },
        data: { 
          status: 'succeeded',
          updatedAt: new Date()
        }
      });
      
      console.log(`Stripe payment ${payment.id} succeeded during retry check`);
      return true;
    }
    
    // Check if payment is still retryable based on Stripe status
    const retryableStatuses = ['requires_payment_method', 'requires_confirmation'];
    if (!retryableStatuses.includes(paymentIntent.status)) {
      console.log(`Stripe payment ${payment.id} is no longer retryable, status: ${paymentIntent.status}`);
      return false;
    }
    
    // For card payments, we generally can't automatically retry
    // But we can check if user might have updated their payment method
    if (attemptNumber < DEFAULT_RETRY_CONFIG.maxRetries) {
      await schedulePaymentRetry(payment.id, attemptNumber, `Stripe payment retry - status: ${paymentIntent.status}`);
      return true;
    }
    
  } catch (error) {
    console.error(`Error during Stripe payment retry for ${payment.id}:`, error);
    
    // If API call fails, still schedule retry if attempts remain
    if (attemptNumber < DEFAULT_RETRY_CONFIG.maxRetries) {
      await schedulePaymentRetry(payment.id, attemptNumber, `Stripe API error retry: ${(error as Error).message}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Retry Flutterwave payment
 */
async function retryFlutterwavePayment(payment: Payment, attemptNumber: number): Promise<boolean> {
  console.log(`Retrying Flutterwave payment ${payment.externalId}, attempt ${attemptNumber}`);
  
  try {
    // Import Flutterwave utils to check transaction status
    const { verifyFlutterwaveTransaction } = await import('@/lib/utils/flutterwaveUtils');
    
    // Verify the transaction status with Flutterwave
    const verificationResult = await verifyFlutterwaveTransaction(payment.externalId);
    
    if (verificationResult) {
      // Check if status has changed
      if (verificationResult.status === 'successful') {
        // Payment succeeded, update our database
        await prisma.payment.update({
          where: { id: payment.id },
          data: { 
            status: 'succeeded',
            updatedAt: new Date()
          }
        });
        
        console.log(`Flutterwave payment ${payment.id} succeeded during retry check`);
        return true;
      }
      
      // For mobile money, some failures might be temporary (network issues, insufficient balance that might be resolved)
      if (verificationResult.status === 'failed') {
        const retryableReasons = [
          'insufficient_funds',
          'network_error', 
          'timeout',
          'temporary_failure'
        ];
        
        // Check if this is a retryable failure
        const isRetryable = retryableReasons.some(reason => 
          verificationResult.message?.toLowerCase().includes(reason.replace('_', ' '))
        );
        
        if (isRetryable && attemptNumber < DEFAULT_RETRY_CONFIG.maxRetries) {
          await schedulePaymentRetry(payment.id, attemptNumber, `Flutterwave retryable failure: ${verificationResult.message}`);
          return true;
        }
        
        console.log(`Flutterwave payment ${payment.id} failed permanently: ${verificationResult.message}`);
        return false;
      }
    }
    
    // If we can't verify or status is pending, schedule retry
    if (attemptNumber < DEFAULT_RETRY_CONFIG.maxRetries) {
      await schedulePaymentRetry(payment.id, attemptNumber, 'Flutterwave status verification retry');
      return true;
    }
    
  } catch (error) {
    console.error(`Error during Flutterwave payment retry for ${payment.id}:`, error);
    
    // If verification fails, still schedule retry if attempts remain
    if (attemptNumber < DEFAULT_RETRY_CONFIG.maxRetries) {
      await schedulePaymentRetry(payment.id, attemptNumber, `Flutterwave verification error: ${(error as Error).message}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Retry MyCoolPay payment
 */
async function retryMyCoolPayPayment(payment: Payment, attemptNumber: number): Promise<boolean> {
  console.log(`Retrying MyCoolPay payment ${payment.externalId}, attempt ${attemptNumber}`);
  
  try {
    // Import MyCoolPay utils to check transaction status
    const { checkMyCoolPayTransactionStatus } = await import('@/lib/utils/mycoolpayUtils');
    
    // Check the transaction status with MyCoolPay
    const statusResult = await checkMyCoolPayTransactionStatus(payment.reference);
    
    if (statusResult) {
      // Check if status has changed to success
      if (statusResult.status === 'SUCCESS') {
        // Payment succeeded, update our database
        await prisma.payment.update({
          where: { id: payment.id },
          data: { 
            status: 'succeeded',
            receivedAmount: statusResult.amount || payment.paidAmount,
            updatedAt: new Date()
          }
        });
        
        console.log(`MyCoolPay payment ${payment.id} succeeded during retry check`);
        return true;
      }
      
      // For mobile money failures, some might be temporary
      if (statusResult.status === 'FAILED' || statusResult.status === 'CANCELED') {
        const retryableReasons = [
          'insufficient_balance',
          'network_timeout',
          'operator_unavailable',
          'temporary_error',
          'timeout'
        ];
        
        // Check if this is a retryable failure
        const isRetryable = retryableReasons.some(reason => 
          statusResult.message?.toLowerCase().includes(reason)
        );
        
        if (isRetryable && attemptNumber < DEFAULT_RETRY_CONFIG.maxRetries) {
          await schedulePaymentRetry(payment.id, attemptNumber, `MyCoolPay retryable failure: ${statusResult.message}`);
          return true;
        }
        
        console.log(`MyCoolPay payment ${payment.id} failed permanently: ${statusResult.message}`);
        return false;
      }
      
      // If status is PENDING or unknown, retry
      if (statusResult.status === 'PENDING' && attemptNumber < DEFAULT_RETRY_CONFIG.maxRetries) {
        await schedulePaymentRetry(payment.id, attemptNumber, 'MyCoolPay payment still pending');
        return true;
      }
    }
    
    // If we can't check status, schedule retry
    if (attemptNumber < DEFAULT_RETRY_CONFIG.maxRetries) {
      await schedulePaymentRetry(payment.id, attemptNumber, 'MyCoolPay status check retry');
      return true;
    }
    
  } catch (error) {
    console.error(`Error during MyCoolPay payment retry for ${payment.id}:`, error);
    
    // If status check fails, still schedule retry if attempts remain
    if (attemptNumber < DEFAULT_RETRY_CONFIG.maxRetries) {
      await schedulePaymentRetry(payment.id, attemptNumber, `MyCoolPay status check error: ${(error as Error).message}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Mark payment as retry exhausted
 */
async function markPaymentRetryExhausted(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: true }
  });

  if (!payment) return;

  const currentMeta = payment.meta ? JSON.parse(payment.meta) : {};
  const updatedMeta = {
    ...currentMeta,
    retryInfo: {
      ...currentMeta.retryInfo,
      exhausted: true,
      exhaustedAt: new Date().toISOString(),
      finalStatus: 'retry_exhausted'
    }
  };

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      meta: JSON.stringify(updatedMeta),
      status: 'failed', // Ensure final status is failed
      updatedAt: new Date(),
    }
  });

  // Send notification to user about exhausted retries
  if (payment.user?.email) {
    try {
      await sendEmail({
        to: payment.user.email,
        subject: 'Payment Processing - Final Attempt',
        html: `
          <h2>Payment Processing Update</h2>
          <p>We've made several attempts to process your payment but were unable to complete it.</p>
          <p>Payment Reference: ${payment.reference}</p>
          <p>Please try again with a different payment method or contact support if you need assistance.</p>
        `,
        text: `Payment processing failed after multiple attempts. Reference: ${payment.reference}. Please try again or contact support.`
      });
    } catch (emailError) {
      console.error('Failed to send retry exhausted email:', emailError);
    }
  }

  console.log(`Payment retry exhausted: ${paymentId}`);
}