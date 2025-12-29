/**
 * Unified Payment Provider Configuration System
 * Supports Stripe (international cards), Flutterwave (Africa cards + mobile money), MyCoolPay (Africa mobile money)
 */

import { PaymentProviderName, Currency } from "@prisma/client";

export interface PaymentProviderConfig {
  name: PaymentProviderName;
  displayName: string;
  description: string;
  supportedRegions: string[];
  supportedCurrencies: Currency[];
  paymentMethods: PaymentMethod[];
  webhookConfig: WebhookConfig;
  retryConfig: ProviderRetryConfig;
  features: ProviderFeatures;
}

export interface PaymentMethod {
  type: 'card' | 'mobile_money' | 'bank_transfer';
  name: string;
  operators?: string[]; // For mobile money
  countries?: string[]; // Country restrictions
  minAmount?: number;
  maxAmount?: number;
}

export interface WebhookConfig {
  signatureHeader: string;
  signatureValidation: 'hash' | 'signature' | 'none';
  eventTypes: string[];
  retryable: boolean;
}

export interface ProviderRetryConfig {
  enabled: boolean;
  maxRetries: number;
  baseDelayMs: number;
  statusCheckEndpoint?: string;
  retryableErrors: string[];
  permanentErrors: string[];
}

export interface ProviderFeatures {
  supportsIdempotency: boolean;
  supportsRefunds: boolean;
  supportsPartialRefunds: boolean;
  supportsRecurringPayments: boolean;
  supportsWebhooks: boolean;
  supportsStatusCheck: boolean;
  realTimeUpdates: boolean;
}

/**
 * Stripe Configuration
 * Primary provider for international card payments
 */
const stripeConfig: PaymentProviderConfig = {
  name: 'stripe',
  displayName: 'Stripe',
  description: 'International card payments via Stripe',
  supportedRegions: ['global'], // Available globally
  supportedCurrencies: ['eur', 'usd', 'gbp'],
  paymentMethods: [
    {
      type: 'card',
      name: 'Credit/Debit Cards',
      countries: ['global'],
      minAmount: 0.50,
      maxAmount: 999999
    }
  ],
  webhookConfig: {
    signatureHeader: 'stripe-signature',
    signatureValidation: 'signature',
    eventTypes: ['payment_intent.succeeded', 'payment_intent.payment_failed'],
    retryable: true
  },
  retryConfig: {
    enabled: true,
    maxRetries: 3,
    baseDelayMs: 30000,
    statusCheckEndpoint: 'payment_intents',
    retryableErrors: ['card_declined', 'insufficient_funds', 'processing_error'],
    permanentErrors: ['card_declined_permanently', 'stolen_card', 'lost_card']
  },
  features: {
    supportsIdempotency: true,
    supportsRefunds: true,
    supportsPartialRefunds: true,
    supportsRecurringPayments: true,
    supportsWebhooks: true,
    supportsStatusCheck: true,
    realTimeUpdates: true
  }
};

/**
 * Flutterwave Configuration  
 * Primary provider for Africa - cards and mobile money
 */
const flutterwaveConfig: PaymentProviderConfig = {
  name: 'flutterwave',
  displayName: 'Flutterwave',
  description: 'African card payments and mobile money via Flutterwave',
  supportedRegions: ['africa'],
  supportedCurrencies: ['xaf', 'xof'],
  paymentMethods: [
    {
      type: 'card',
      name: 'African Cards',
      countries: ['NG', 'GH', 'KE', 'UG', 'RW', 'CM', 'SN', 'CI', 'BF', 'ML'],
      minAmount: 100,
      maxAmount: 10000000
    },
    {
      type: 'mobile_money',
      name: 'Mobile Money',
      operators: ['MTN', 'Orange', 'Airtel', 'Vodafone', 'Safaricom', 'Moov'],
      countries: ['NG', 'GH', 'KE', 'UG', 'RW', 'CM', 'SN', 'CI', 'BF', 'ML'],
      minAmount: 100,
      maxAmount: 5000000
    }
  ],
  webhookConfig: {
    signatureHeader: 'verif-hash',
    signatureValidation: 'hash',
    eventTypes: ['charge.completed'],
    retryable: true
  },
  retryConfig: {
    enabled: true,
    maxRetries: 5, // Higher for mobile money due to network issues
    baseDelayMs: 60000, // Longer delay for mobile money processing
    statusCheckEndpoint: 'transactions/verify',
    retryableErrors: ['insufficient_funds', 'network_error', 'timeout', 'operator_unavailable'],
    permanentErrors: ['invalid_account', 'blocked_account', 'fraud_detected']
  },
  features: {
    supportsIdempotency: true,
    supportsRefunds: false, // Limited refund support
    supportsPartialRefunds: false,
    supportsRecurringPayments: false,
    supportsWebhooks: true,
    supportsStatusCheck: true,
    realTimeUpdates: true
  }
};

/**
 * MyCoolPay Configuration
 * Specialized provider for Africa mobile money
 */
const mycoolpayConfig: PaymentProviderConfig = {
  name: 'mycoolpay',
  displayName: 'MyCoolPay',
  description: 'African mobile money specialist via MyCoolPay',
  supportedRegions: ['africa'],
  supportedCurrencies: ['xaf', 'xof'],
  paymentMethods: [
    {
      type: 'mobile_money',
      name: 'Mobile Money Franco',
      operators: ['MTN', 'Orange', 'Moov'],
      countries: ['CM', 'SN', 'CI', 'BF', 'ML', 'TD', 'NE', 'GN'],
      minAmount: 100,
      maxAmount: 1000000
    }
  ],
  webhookConfig: {
    signatureHeader: 'signature',
    signatureValidation: 'hash',
    eventTypes: ['transaction.completed', 'transaction.failed'],
    retryable: true
  },
  retryConfig: {
    enabled: true,
    maxRetries: 4,
    baseDelayMs: 45000,
    statusCheckEndpoint: 'transactions/status',
    retryableErrors: ['insufficient_balance', 'network_timeout', 'operator_unavailable', 'temporary_error'],
    permanentErrors: ['invalid_phone', 'blocked_account', 'operator_not_supported']
  },
  features: {
    supportsIdempotency: true,
    supportsRefunds: false,
    supportsPartialRefunds: false,
    supportsRecurringPayments: false,
    supportsWebhooks: true,
    supportsStatusCheck: true,
    realTimeUpdates: true
  }
};

/**
 * Apple In-App Purchase Configuration
 * iOS App Store subscriptions and in-app purchases
 */
const appleIapConfig: PaymentProviderConfig = {
  name: 'apple_iap',
  displayName: 'Apple In-App Purchase',
  description: 'iOS App Store subscriptions and in-app purchases',
  supportedRegions: ['global'],
  supportedCurrencies: ['eur', 'usd', 'gbp', 'xaf', 'xof'],
  paymentMethods: [
    {
      type: 'mobile_money',
      name: 'Apple In-App Purchase',
      countries: ['global'],
      minAmount: 0,
      maxAmount: 999999
    }
  ],
  webhookConfig: {
    signatureHeader: 'none',
    signatureValidation: 'signature',
    eventTypes: ['DID_RENEW', 'DID_FAIL_TO_RENEW', 'EXPIRED', 'REFUND'],
    retryable: false
  },
  retryConfig: {
    enabled: false,
    maxRetries: 0,
    baseDelayMs: 0,
    retryableErrors: [],
    permanentErrors: []
  },
  features: {
    supportsIdempotency: true,
    supportsRefunds: true,
    supportsPartialRefunds: false,
    supportsRecurringPayments: true,
    supportsWebhooks: true,
    supportsStatusCheck: true,
    realTimeUpdates: true
  }
};

/**
 * Apple Pay Configuration
 * Web-based Apple Pay payments
 */
const applePayConfig: PaymentProviderConfig = {
  name: 'apple_pay',
  displayName: 'Apple Pay',
  description: 'Web-based Apple Pay payments',
  supportedRegions: ['global'],
  supportedCurrencies: ['eur', 'usd', 'gbp', 'xaf', 'xof'],
  paymentMethods: [
    {
      type: 'mobile_money',
      name: 'Apple Pay',
      countries: ['global'],
      minAmount: 0,
      maxAmount: 999999
    }
  ],
  webhookConfig: {
    signatureHeader: 'none',
    signatureValidation: 'none',
    eventTypes: [],
    retryable: false
  },
  retryConfig: {
    enabled: false,
    maxRetries: 0,
    baseDelayMs: 0,
    retryableErrors: [],
    permanentErrors: []
  },
  features: {
    supportsIdempotency: true,
    supportsRefunds: false,
    supportsPartialRefunds: false,
    supportsRecurringPayments: true,
    supportsWebhooks: false,
    supportsStatusCheck: false,
    realTimeUpdates: true
  }
};

/**
 * All provider configurations
 */
export const PAYMENT_PROVIDERS: Record<PaymentProviderName, PaymentProviderConfig> = {
  stripe: stripeConfig,
  flutterwave: flutterwaveConfig,
  mycoolpay: mycoolpayConfig,
  apple_iap: appleIapConfig,
  apple_pay: applePayConfig
};

/**
 * Get configuration for a specific provider
 */
export function getProviderConfig(provider: PaymentProviderName): PaymentProviderConfig {
  return PAYMENT_PROVIDERS[provider];
}

/**
 * Get providers available for a specific region
 */
export function getProvidersForRegion(region: string): PaymentProviderConfig[] {
  return Object.values(PAYMENT_PROVIDERS).filter(config =>
    config.supportedRegions.includes(region) || config.supportedRegions.includes('global')
  );
}

/**
 * Get providers supporting a specific currency
 */
export function getProvidersForCurrency(currency: Currency): PaymentProviderConfig[] {
  return Object.values(PAYMENT_PROVIDERS).filter(config =>
    config.supportedCurrencies.includes(currency)
  );
}

/**
 * Get providers supporting a specific payment method
 */
export function getProvidersForPaymentMethod(method: 'card' | 'mobile_money' | 'bank_transfer'): PaymentProviderConfig[] {
  return Object.values(PAYMENT_PROVIDERS).filter(config =>
    config.paymentMethods.some(pm => pm.type === method)
  );
}

/**
 * Get the best provider for a given context
 */
export function getBestProvider(
  region: string,
  currency: Currency,
  paymentMethod: 'card' | 'mobile_money' | 'bank_transfer',
  amount: number
): PaymentProviderConfig | null {
  const availableProviders = Object.values(PAYMENT_PROVIDERS).filter(config => {
    // Check region support
    const regionSupported = config.supportedRegions.includes(region) || config.supportedRegions.includes('global');
    
    // Check currency support
    const currencySupported = config.supportedCurrencies.includes(currency);
    
    // Check payment method and amount support
    const methodSupported = config.paymentMethods.some(pm => {
      if (pm.type !== paymentMethod) return false;
      if (pm.minAmount && amount < pm.minAmount) return false;
      if (pm.maxAmount && amount > pm.maxAmount) return false;
      return true;
    });
    
    return regionSupported && currencySupported && methodSupported;
  });

  if (availableProviders.length === 0) return null;

  // Priority logic:
  // 1. For cards: Prefer Stripe globally, Flutterwave for Africa
  // 2. For mobile money: Prefer MyCoolPay for Franco zones, Flutterwave for others
  
  if (paymentMethod === 'card') {
    if (region === 'africa') {
      return availableProviders.find(p => p.name === 'flutterwave') || availableProviders[0];
    } else {
      return availableProviders.find(p => p.name === 'stripe') || availableProviders[0];
    }
  }
  
  if (paymentMethod === 'mobile_money') {
    if (['XAF', 'XOF'].includes(currency)) {
      return availableProviders.find(p => p.name === 'mycoolpay') || availableProviders[0];
    } else {
      return availableProviders.find(p => p.name === 'flutterwave') || availableProviders[0];
    }
  }
  
  return availableProviders[0];
}

/**
 * Validate provider configuration at startup
 */
export function validateProviderConfigs(): boolean {
  const requiredEnvVars = [
    'STRIPE_SECRET_KEY',
    'FLW_SECRET_KEY',
    'FLW_SECRET_HASH', 
    'MYCOOLPAY_SECRET_KEY'
  ];
  
  const missing = requiredEnvVars.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables for payment providers:', missing);
    return false;
  }
  
  return true;
}

/**
 * Get provider-specific retry configuration
 */
export function getRetryConfigForProvider(provider: PaymentProviderName): ProviderRetryConfig {
  return getProviderConfig(provider).retryConfig;
}

/**
 * Check if error is retryable for provider
 */
export function isErrorRetryable(provider: PaymentProviderName, errorMessage: string): boolean {
  const config = getProviderConfig(provider);
  
  // Check if error is explicitly non-retryable
  const isPermanent = config.retryConfig.permanentErrors.some(error =>
    errorMessage.toLowerCase().includes(error.toLowerCase())
  );
  
  if (isPermanent) return false;
  
  // Check if error is explicitly retryable
  const isRetryable = config.retryConfig.retryableErrors.some(error =>
    errorMessage.toLowerCase().includes(error.toLowerCase())
  );
  
  return isRetryable;
}

/**
 * Backward compatibility check
 */
export function ensureBackwardCompatibility(): void {
  // Ensure all existing payment provider names are supported
  const legacyProviders = ['stripe', 'flutterwave', 'mycoolpay'];
  const configuredProviders = Object.keys(PAYMENT_PROVIDERS);
  
  const missing = legacyProviders.filter(provider => !configuredProviders.includes(provider));
  
  if (missing.length > 0) {
    console.error('Missing configuration for legacy providers:', missing);
    throw new Error('Backward compatibility check failed: missing provider configurations');
  }
  
  console.log('✅ Payment provider backward compatibility verified');
}