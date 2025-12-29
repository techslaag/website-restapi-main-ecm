import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { User } from "@prisma/client";

export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = "login_success",
  LOGIN_FAILED = "login_failed",
  LOGOUT = "logout",
  TOKEN_REFRESH = "token_refresh",
  SESSION_EXPIRED = "session_expired",
  
  // Subscription events
  SUBSCRIPTION_CREATED = "subscription_created",
  SUBSCRIPTION_UPGRADED = "subscription_upgraded",
  SUBSCRIPTION_DOWNGRADED = "subscription_downgraded",
  SUBSCRIPTION_CANCELLED = "subscription_cancelled",
  SUBSCRIPTION_EXPIRED = "subscription_expired",
  
  // Payment events
  PAYMENT_INITIATED = "payment_initiated",
  PAYMENT_SUCCESS = "payment_success",
  PAYMENT_FAILED = "payment_failed",
  PAYMENT_REFUNDED = "payment_refunded",
  
  // Security events
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
  INVALID_TOKEN = "invalid_token",
  UNAUTHORIZED_ACCESS = "unauthorized_access",
  SUSPICIOUS_ACTIVITY = "suspicious_activity",
  
  // Business logic events
  PRICE_CALCULATION = "price_calculation",
  ELIGIBILITY_CHECK = "eligibility_check",
  CONCURRENT_REQUEST_BLOCKED = "concurrent_request_blocked",
  
  // Admin events
  USER_CREATED = "user_created",
  USER_UPDATED = "user_updated",
  USER_DELETED = "user_deleted",
  PLAN_CREATED = "plan_created",
  PLAN_UPDATED = "plan_updated"
}

export enum AuditSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical"
}

export interface AuditMetadata {
  [key: string]: any;
}

export interface AuditLogEntry {
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  metadata?: AuditMetadata;
  timestamp: Date;
  message: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

class AuditLogger {
  private async logToDatabase(entry: AuditLogEntry): Promise<void> {
    try {
      // For now, log to console. In production, you should store in a dedicated audit table
      console.log('[AUDIT]', {
        timestamp: entry.timestamp.toISOString(),
        eventType: entry.eventType,
        severity: entry.severity,
        userId: entry.userId,
        success: entry.success,
        message: entry.message,
        metadata: entry.metadata
      });

      // TODO: Implement database audit logging
      // await prisma.auditLog.create({
      //   data: {
      //     eventType: entry.eventType,
      //     severity: entry.severity,
      //     userId: entry.userId,
      //     userEmail: entry.userEmail,
      //     ipAddress: entry.ipAddress,
      //     userAgent: entry.userAgent,
      //     endpoint: entry.endpoint,
      //     method: entry.method,
      //     metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      //     message: entry.message,
      //     success: entry.success,
      //     errorCode: entry.errorCode,
      //     errorMessage: entry.errorMessage,
      //     timestamp: entry.timestamp
      //   }
      // });

    } catch (error) {
      console.error('[AUDIT] Failed to log audit entry:', error);
      // Fail silently to prevent audit logging from breaking the application
    }
  }

  private extractRequestInfo(request?: NextRequest): Partial<AuditLogEntry> {
    if (!request) return {};

    return {
      ipAddress: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || undefined,
      endpoint: request.url,
      method: request.method
    };
  }

  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    
    return forwarded?.split(',')[0]?.trim() || 
           realIp || 
           cfConnectingIp || 
           request.ip || 
           'unknown';
  }

  async log(
    eventType: AuditEventType,
    message: string,
    options: {
      severity?: AuditSeverity;
      user?: User;
      request?: NextRequest;
      success?: boolean;
      metadata?: AuditMetadata;
      errorCode?: string;
      errorMessage?: string;
    } = {}
  ): Promise<void> {
    const {
      severity = AuditSeverity.MEDIUM,
      user,
      request,
      success = true,
      metadata,
      errorCode,
      errorMessage
    } = options;

    const entry: AuditLogEntry = {
      eventType,
      severity,
      userId: user?.id,
      userEmail: user?.email || undefined,
      timestamp: new Date(),
      message,
      success,
      errorCode,
      errorMessage,
      metadata,
      ...this.extractRequestInfo(request)
    };

    await this.logToDatabase(entry);
  }

  // Convenience methods for common events
  async logAuthSuccess(user: User, request?: NextRequest, metadata?: AuditMetadata): Promise<void> {
    await this.log(
      AuditEventType.LOGIN_SUCCESS,
      `User ${user.email} successfully authenticated`,
      {
        severity: AuditSeverity.LOW,
        user,
        request,
        success: true,
        metadata
      }
    );
  }

  async logAuthFailure(email: string, reason: string, request?: NextRequest, metadata?: AuditMetadata): Promise<void> {
    await this.log(
      AuditEventType.LOGIN_FAILED,
      `Authentication failed for ${email}: ${reason}`,
      {
        severity: AuditSeverity.MEDIUM,
        request,
        success: false,
        metadata: { email, reason, ...metadata }
      }
    );
  }

  async logSubscriptionUpgrade(
    user: User, 
    fromPlan: string, 
    toPlan: string, 
    amount: number,
    request?: NextRequest,
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log(
      AuditEventType.SUBSCRIPTION_UPGRADED,
      `User ${user.email} upgraded subscription from ${fromPlan} to ${toPlan} for ${amount}€`,
      {
        severity: AuditSeverity.HIGH,
        user,
        request,
        success: true,
        metadata: {
          fromPlan,
          toPlan,
          amount,
          currency: 'EUR',
          ...metadata
        }
      }
    );
  }

  async logPaymentEvent(
    eventType: AuditEventType,
    user: User,
    amount: number,
    currency: string,
    paymentId: string,
    success: boolean,
    request?: NextRequest,
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log(
      eventType,
      `Payment ${success ? 'succeeded' : 'failed'} for user ${user.email}: ${amount} ${currency}`,
      {
        severity: success ? AuditSeverity.MEDIUM : AuditSeverity.HIGH,
        user,
        request,
        success,
        metadata: {
          amount,
          currency,
          paymentId,
          ...metadata
        }
      }
    );
  }

  async logSecurityEvent(
    eventType: AuditEventType,
    message: string,
    severity: AuditSeverity,
    request?: NextRequest,
    user?: User,
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log(
      eventType,
      message,
      {
        severity,
        user,
        request,
        success: false,
        metadata
      }
    );
  }

  async logRateLimitExceeded(
    endpoint: string,
    limit: number,
    request?: NextRequest,
    user?: User
  ): Promise<void> {
    await this.logSecurityEvent(
      AuditEventType.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded for ${endpoint}: ${limit} requests`,
      AuditSeverity.MEDIUM,
      request,
      user,
      { endpoint, limit }
    );
  }

  async logUnauthorizedAccess(
    reason: string,
    request?: NextRequest,
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.logSecurityEvent(
      AuditEventType.UNAUTHORIZED_ACCESS,
      `Unauthorized access attempt: ${reason}`,
      AuditSeverity.HIGH,
      request,
      undefined,
      metadata
    );
  }

  async logConcurrentRequestBlocked(
    user: User,
    operation: string,
    request?: NextRequest
  ): Promise<void> {
    await this.log(
      AuditEventType.CONCURRENT_REQUEST_BLOCKED,
      `Concurrent ${operation} request blocked for user ${user.email}`,
      {
        severity: AuditSeverity.LOW,
        user,
        request,
        success: false,
        metadata: { operation }
      }
    );
  }

  async logBusinessLogicEvent(
    operation: string,
    details: string,
    user: User,
    success: boolean,
    request?: NextRequest,
    metadata?: AuditMetadata
  ): Promise<void> {
    await this.log(
      AuditEventType.ELIGIBILITY_CHECK,
      `${operation}: ${details} for user ${user.email}`,
      {
        severity: AuditSeverity.LOW,
        user,
        request,
        success,
        metadata: { operation, ...metadata }
      }
    );
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

// Export convenience function for quick logging
export async function logAuditEvent(
  eventType: AuditEventType,
  message: string,
  options?: Parameters<typeof auditLogger.log>[2]
): Promise<void> {
  await auditLogger.log(eventType, message, options);
}