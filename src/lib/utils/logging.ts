// Simple logging utility that only uses console and NotificationLog for notifications

export interface NotificationActivityLog {
  requestId: string;
  action: string;
  userId: string | null;
  status: 'success' | 'error' | 'unauthorized' | 'validation_failed' | 'no_targets';
  error?: string;
  metadata?: Record<string, any>;
}

export async function logNotificationActivity(log: NotificationActivityLog): Promise<void> {
  try {
    // Log to console immediately
    console.log(`[NOTIFICATION] ${log.action} - ${log.status}`, {
      requestId: log.requestId,
      userId: log.userId,
      error: log.error,
      metadata: log.metadata
    });
  } catch (error) {
    // Don't throw errors from logging to avoid breaking the main flow
    console.error("Notification activity logging error:", error);
  }
}

export interface SystemLog {
  level: 'info' | 'warn' | 'error' | 'debug';
  service: string;
  message: string;
  metadata?: Record<string, any>;
  userId?: string;
}

export async function logSystem(log: SystemLog): Promise<void> {
  try {
    // Log to console for immediate visibility
    const logMethod = console[log.level] || console.log;
    logMethod(`[${log.service.toUpperCase()}] ${log.message}`, log.metadata);
  } catch (error) {
    console.error("System logging error:", error);
  }
}

export class NotificationLogger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  async info(message: string, metadata?: Record<string, any>, userId?: string) {
    await logSystem({
      level: 'info',
      service: this.service,
      message,
      metadata,
      userId
    });
  }

  async warn(message: string, metadata?: Record<string, any>, userId?: string) {
    await logSystem({
      level: 'warn',
      service: this.service,
      message,
      metadata,
      userId
    });
  }

  async error(message: string, metadata?: Record<string, any>, userId?: string) {
    await logSystem({
      level: 'error',
      service: this.service,
      message,
      metadata,
      userId
    });
  }

  async debug(message: string, metadata?: Record<string, any>, userId?: string) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_LOGGING === 'true') {
      await logSystem({
        level: 'debug',
        service: this.service,
        message,
        metadata,
        userId
      });
    }
  }
}

// Pre-configured loggers for different services
export const notificationLogger = new NotificationLogger('notifications');
export const authLogger = new NotificationLogger('auth');
export const apiLogger = new NotificationLogger('api');