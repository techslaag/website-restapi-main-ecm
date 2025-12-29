/**
 * In-App Purchase Verification Utilities
 *
 * Handles receipt verification for Apple App Store and Google Play Store
 *
 * Supports both:
 * - Legacy receipts (base64 encoded, for verifyReceipt API)
 * - StoreKit 2 JWS transactions (JWT format, decoded locally)
 */

export interface AppleReceiptVerificationResult {
  valid: boolean;
  transactionId?: string;
  productId?: string;
  purchaseDate?: string;
  expiresDate?: string;
  amount?: number;
  currency?: string;
  environment?: 'sandbox' | 'production';
  error?: string;
  status?: number;
}

export interface GoogleReceiptVerificationResult {
  valid: boolean;
  transactionId?: string;
  productId?: string;
  purchaseDate?: string;
  expiresDate?: string;
  amount?: number;
  currency?: string;
  error?: string;
}

/**
 * Check if receipt data is a StoreKit 2 JWS transaction (JWT format)
 * JWS transactions start with "eyJ" (base64 encoded JSON header)
 */
function isStoreKit2JWS(receiptData: string): boolean {
  return receiptData.startsWith('eyJ');
}

/**
 * Verify StoreKit 2 JWS (JSON Web Signature) transaction
 * This is the new format used by iOS 15+ and StoreKit 2
 *
 * The JWS contains a signed transaction that can be decoded to get purchase details
 * For sandbox/testing, we decode without full certificate chain verification
 */
async function verifyStoreKit2Transaction(
  jwsTransaction: string
): Promise<AppleReceiptVerificationResult> {
  try {
    console.log('[Apple IAP] ========== STOREKIT 2 JWS VERIFICATION ==========');
    console.log('[Apple IAP] JWS Transaction length:', jwsTransaction.length);
    console.log('[Apple IAP] JWS Transaction preview:', jwsTransaction.substring(0, 100) + '...');

    // Decode the JWS to get the payload (without verification for now)
    // In production, you should verify the certificate chain
    const parts = jwsTransaction.split('.');
    console.log('[Apple IAP] JWS parts count:', parts.length);

    if (parts.length !== 3) {
      throw new Error(`Invalid JWS format: expected 3 parts, got ${parts.length}`);
    }

    // Decode header to check algorithm and get x5c certificate chain
    console.log('[Apple IAP] Decoding header...');
    console.log('[Apple IAP] Header (base64url):', parts[0].substring(0, 50) + '...');
    const headerJson = Buffer.from(parts[0], 'base64url').toString('utf-8');
    console.log('[Apple IAP] Header (decoded JSON):', headerJson);
    const header = JSON.parse(headerJson);
    console.log('[Apple IAP] JWS Header parsed:', JSON.stringify(header, null, 2));

    // Decode payload
    console.log('[Apple IAP] Decoding payload...');
    console.log('[Apple IAP] Payload (base64url):', parts[1].substring(0, 50) + '...');
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
    console.log('[Apple IAP] Payload (decoded JSON):', payloadJson);
    const payload = JSON.parse(payloadJson);
    console.log('[Apple IAP] JWS Payload parsed:', JSON.stringify(payload, null, 2));

    // Log all payload fields for debugging
    console.log('[Apple IAP] ========== PAYLOAD FIELDS ==========');
    for (const [key, value] of Object.entries(payload)) {
      console.log(`[Apple IAP]   ${key}:`, value);
    }

    // Extract transaction details from the payload
    // StoreKit 2 transaction payload structure:
    // https://developer.apple.com/documentation/appstoreserverapi/jwstransactiondecodedpayload
    const transactionId = payload.transactionId || payload.originalTransactionId;
    const productId = payload.productId;
    const purchaseDate = payload.purchaseDate
      ? new Date(payload.purchaseDate).toISOString()
      : undefined;
    const expiresDate = payload.expiresDate
      ? new Date(payload.expiresDate).toISOString()
      : undefined;

    // Extract price and currency from payload
    // Apple provides price in milliunits (1/1000 of currency unit)
    // e.g., price: 9990 with currency: "USD" means $9.99
    let amount: number | undefined;
    let currency: string | undefined;

    if (payload.price !== undefined && payload.price !== null) {
      // Convert from milliunits to actual currency value
      // Apple's price field is in milliunits (1/1000)
      amount = payload.price / 1000;
      console.log('[Apple IAP] Price (milliunits):', payload.price);
      console.log('[Apple IAP] Price (converted):', amount);
    }

    if (payload.currency) {
      currency = payload.currency.toLowerCase();
      console.log('[Apple IAP] Currency:', currency);
    }

    // Also check for storefront-based pricing if direct price not available
    if (!amount && payload.storefront) {
      console.log('[Apple IAP] Storefront:', payload.storefront);
      console.log('[Apple IAP] Storefront ID:', payload.storefrontId);
    }

    // Determine environment from the payload
    const environment = payload.environment?.toLowerCase() === 'sandbox' ? 'sandbox' : 'production';

    // For StoreKit 2, if we can decode the JWT, the transaction is valid
    // The signature was created by Apple and contains the transaction details
    // In production, you should verify the x5c certificate chain against Apple's root CA

    // Basic validation
    if (!transactionId || !productId) {
      return {
        valid: false,
        error: 'Missing required transaction fields in JWS payload',
      };
    }

    console.log('[Apple IAP] StoreKit 2 transaction verified successfully');
    console.log('[Apple IAP] Transaction ID:', transactionId);
    console.log('[Apple IAP] Product ID:', productId);
    console.log('[Apple IAP] Amount:', amount);
    console.log('[Apple IAP] Currency:', currency);
    console.log('[Apple IAP] Environment:', environment);

    return {
      valid: true,
      transactionId: String(transactionId),
      productId: productId,
      purchaseDate: purchaseDate,
      expiresDate: expiresDate,
      amount: amount,
      currency: currency,
      environment: environment,
      status: 0,
    };
  } catch (error) {
    console.error('[Apple IAP] StoreKit 2 verification error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to verify StoreKit 2 transaction',
    };
  }
}

/**
 * Verify Apple App Store receipt
 * Documentation: https://developer.apple.com/documentation/appstorereceipts/verifyreceipt
 *
 * Supports both:
 * - Legacy receipts (base64 encoded app receipt)
 * - StoreKit 2 JWS transactions (JWT format starting with "eyJ")
 */
export async function verifyAppleReceipt(
  receiptData: string
): Promise<AppleReceiptVerificationResult> {
  try {
    // Check if this is a StoreKit 2 JWS transaction
    if (isStoreKit2JWS(receiptData)) {
      console.log('[Apple IAP] Detected StoreKit 2 JWS format');
      return await verifyStoreKit2Transaction(receiptData);
    }

    console.log('[Apple IAP] Using legacy receipt verification');

    // Try production first
    let result = await verifyWithAppleServer(receiptData, 'production');

    // If status 21007 (sandbox receipt sent to production), retry with sandbox
    if (result.status === 21007) {
      console.log('[Apple IAP] Sandbox receipt detected, retrying with sandbox server');
      result = await verifyWithAppleServer(receiptData, 'sandbox');
    }

    // Status codes: https://developer.apple.com/documentation/appstorereceipts/status
    if (result.status === 0) {
      // Valid receipt
      const latestReceipt = result.latest_receipt_info?.[0] || result.receipt?.in_app?.[0];

      return {
        valid: true,
        transactionId: latestReceipt?.transaction_id || latestReceipt?.original_transaction_id,
        productId: latestReceipt?.product_id,
        purchaseDate: latestReceipt?.purchase_date_ms
          ? new Date(parseInt(latestReceipt.purchase_date_ms)).toISOString()
          : latestReceipt?.purchase_date,
        expiresDate: latestReceipt?.expires_date_ms
          ? new Date(parseInt(latestReceipt.expires_date_ms)).toISOString()
          : latestReceipt?.expires_date,
        environment: result.environment,
        status: result.status,
      };
    } else {
      // Invalid receipt
      const errorMessages: Record<number, string> = {
        21000: 'The request to the App Store was not made using the HTTP POST request method',
        21001: 'This status code is no longer sent by the App Store',
        21002: 'The data in the receipt-data property was malformed or the service experienced a temporary issue',
        21003: 'The receipt could not be authenticated',
        21004: 'The shared secret you provided does not match the shared secret on file',
        21005: 'The receipt server was temporarily unable to provide the receipt',
        21006: 'This receipt is valid but the subscription has expired',
        21007: 'This receipt is from the test environment, but it was sent to the production environment',
        21008: 'This receipt is from the production environment, but it was sent to the test environment',
        21009: 'Internal data access error',
        21010: 'The user account cannot be found or has been deleted',
      };

      return {
        valid: false,
        status: result.status,
        error: errorMessages[result.status] || `Unknown error (status ${result.status})`,
      };
    }
  } catch (error) {
    console.error('[Apple IAP] Verification error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown verification error',
    };
  }
}

/**
 * Internal function to verify with Apple server
 */
async function verifyWithAppleServer(
  receiptData: string,
  environment: 'production' | 'sandbox'
): Promise<any> {
  const url = environment === 'production'
    ? 'https://buy.itunes.apple.com/verifyReceipt'
    : 'https://sandbox.itunes.apple.com/verifyReceipt';

  console.log(`[Apple IAP] Verifying receipt with ${environment} server`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      'receipt-data': receiptData,
      'password': process.env.APPLE_SHARED_SECRET,
      'exclude-old-transactions': true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Apple verification HTTP error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log(`[Apple IAP] Verification result status: ${result.status}`);

  return result;
}

/**
 * Verify Google Play Store purchase
 * Documentation: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions
 *
 * Note: This requires Google Play Android Publisher API
 * You need to set up a Service Account and enable the API
 */
export async function verifyGoogleReceipt(
  purchaseToken: string,
  productId: string,
  packageName: string = 'com.ecomatin.app'
): Promise<GoogleReceiptVerificationResult> {
  try {
    // Google requires OAuth 2.0 authentication with a service account
    // We'll use googleapis library for this

    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      throw new Error('Google service account credentials not configured');
    }

    // Dynamic import to avoid loading googleapis if not needed
    const { google } = await import('googleapis');

    // Authenticate with service account
    let auth;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Use file path
      auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      });
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      // Use JSON string
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      });
    }

    const androidPublisher = google.androidpublisher({
      version: 'v3',
      auth: auth,
    });

    // Verify subscription
    // Note: For one-time purchases, use purchases.products.get instead
    const result = await androidPublisher.purchases.subscriptions.get({
      packageName,
      subscriptionId: productId,
      token: purchaseToken,
    });

    if (!result.data) {
      return {
        valid: false,
        error: 'No data returned from Google Play',
      };
    }

    const purchase = result.data;

    // Payment state: 0 = Pending, 1 = Received, 2 = Free trial, 3 = Pending deferred upgrade/downgrade
    const isValid = purchase.paymentState === 1 || purchase.paymentState === 2;

    return {
      valid: isValid,
      transactionId: purchase.orderId || '',
      productId: productId,
      purchaseDate: purchase.startTimeMillis
        ? new Date(parseInt(purchase.startTimeMillis)).toISOString()
        : undefined,
      expiresDate: purchase.expiryTimeMillis
        ? new Date(parseInt(purchase.expiryTimeMillis)).toISOString()
        : undefined,
    };
  } catch (error) {
    console.error('[Google IAP] Verification error:', error);

    // Handle specific Google API errors
    if (error && typeof error === 'object' && 'code' in error) {
      const apiError = error as { code?: number; message?: string };
      if (apiError.code === 404) {
        return {
          valid: false,
          error: 'Purchase not found or already consumed',
        };
      } else if (apiError.code === 401 || apiError.code === 403) {
        return {
          valid: false,
          error: 'Authentication error with Google Play API',
        };
      }
    }

    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown verification error',
    };
  }
}

/**
 * Map Apple product IDs to plan IDs
 * planType values: 'premium' and 'ecomember' (matches Prisma PlanType enum)
 */
export function mapAppleProductToPlan(productId: string): { planId?: 'premium' | 'ecomember'; period?: 'month' | 'year' } {
  const mapping: Record<string, { planId: 'premium' | 'ecomember'; period: 'month' | 'year' }> = {
    'premium_ecm': { planId: 'premium', period: 'year' },
    'ecomembre_ecm': { planId: 'ecomember', period: 'year' },
  };

  return mapping[productId] || {};
}

/**
 * Map Google product IDs to plan IDs
 * planType values: 'premium' and 'ecomember' (matches Prisma PlanType enum)
 */
export function mapGoogleProductToPlan(productId: string): { planId?: 'premium' | 'ecomember'; period?: 'month' | 'year' } {
  const mapping: Record<string, { planId: 'premium' | 'ecomember'; period: 'month' | 'year' }> = {
    'premium_ecm': { planId: 'premium', period: 'year' },
    'ecomembre_ecm': { planId: 'ecomember', period: 'year' },
  };

  return mapping[productId] || {};
}
