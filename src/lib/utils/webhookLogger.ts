/**
 * Webhook Security Logging Utility
 * Logs webhook events for security monitoring and audit purposes
 */

export interface WebhookLogData {
  provider: string;
  eventType: string;
  eventId?: string;
  userId?: string;
  clientIp?: string;
  userAgent?: string;
  signatureValid: boolean;
  idempotencyKey?: string;
  timestamp: Date;
  requestHeaders?: Record<string, string>;
  errorMessage?: string;
}

/**
 * Logs webhook security events
 */
export function logWebhookEvent(
  level: 'info' | 'warn' | 'error',
  action: string,
  data: WebhookLogData
) {
  const logEntry = {
    timestamp: data.timestamp.toISOString(),
    level,
    action,
    provider: data.provider,
    eventType: data.eventType,
    eventId: data.eventId,
    userId: data.userId,
    clientIp: data.clientIp,
    userAgent: data.userAgent,
    signatureValid: data.signatureValid,
    idempotencyKey: data.idempotencyKey,
    errorMessage: data.errorMessage,
    // Add security-relevant headers (excluding sensitive data)
    securityHeaders: data.requestHeaders ? {
      'content-type': data.requestHeaders['content-type'],
      'user-agent': data.requestHeaders['user-agent'],
      'x-forwarded-for': data.requestHeaders['x-forwarded-for'],
      'x-real-ip': data.requestHeaders['x-real-ip'],
    } : undefined,
  };

  const message = `WEBHOOK_${action.toUpperCase()}: ${data.provider} ${data.eventType}`;
  
  switch (level) {
    case 'info':
      console.log(message, logEntry);
      break;
    case 'warn':
      console.warn(message, logEntry);
      break;
    case 'error':
      console.error(message, logEntry);
      break;
  }

  // In production, you might want to send these logs to a monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to monitoring service
    // await sendToMonitoring(logEntry);
  }
}

/**
 * Log successful webhook processing
 */
export function logWebhookSuccess(data: WebhookLogData) {
  logWebhookEvent('info', 'processed', data);
}

/**
 * Log webhook security violations
 */
export function logWebhookSecurityViolation(data: WebhookLogData) {
  logWebhookEvent('error', 'security_violation', data);
}

/**
 * Log webhook processing errors
 */
export function logWebhookError(data: WebhookLogData) {
  logWebhookEvent('error', 'processing_error', data);
}

/**
 * Log webhook duplicate attempts (idempotency)
 */
export function logWebhookDuplicate(data: WebhookLogData) {
  logWebhookEvent('warn', 'duplicate_attempt', data);
}