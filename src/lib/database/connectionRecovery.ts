import prisma, { connectionManager } from "@/lib/prisma";

/**
 * Circuit breaker pattern for database connections
 * Prevents cascade failures when database is unavailable
 */

enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failure state - reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing state - allow limited requests
}

interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening
  recoveryTimeout: number;     // Time to wait before trying half-open
  monitoringPeriod: number;    // Time window for counting failures
  halfOpenMaxCalls: number;    // Max calls allowed in half-open state
}

class DatabaseCircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      halfOpenMaxCalls: 3,
      ...config
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.halfOpenCalls = 0;
        console.log('[Circuit Breaker] Attempting recovery (HALF_OPEN)');
      } else {
        throw new Error('Circuit breaker is OPEN - database temporarily unavailable');
      }
    }

    if (this.state === CircuitBreakerState.HALF_OPEN && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      throw new Error('Circuit breaker HALF_OPEN limit exceeded');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    return (Date.now() - this.lastFailureTime) >= this.config.recoveryTimeout;
  }

  private onSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED;
      this.failureCount = 0;
      console.log('[Circuit Breaker] Recovery successful (CLOSED)');
    }
    this.halfOpenCalls++;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      console.log('[Circuit Breaker] Recovery failed, returning to OPEN state');
      return;
    }

    // Clean old failures outside monitoring period
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      console.log(`[Circuit Breaker] Opened due to ${this.failureCount} failures`);
    }
  }

  getState(): { state: CircuitBreakerState; failures: number; lastFailure: Date | null } {
    return {
      state: this.state,
      failures: this.failureCount,
      lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime) : null
    };
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenCalls = 0;
    console.log('[Circuit Breaker] Manual reset to CLOSED state');
  }
}

// Global circuit breaker instance
export const dbCircuitBreaker = new DatabaseCircuitBreaker({
  failureThreshold: process.env.NODE_ENV === 'production' ? 5 : 3,
  recoveryTimeout: process.env.NODE_ENV === 'production' ? 60000 : 30000,
  monitoringPeriod: 300000,
  halfOpenMaxCalls: 3
});

/**
 * Enhanced retry logic with exponential backoff
 */
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
  jitter: boolean;
}

class DatabaseRetryManager {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 10000, // 10 seconds
      exponentialBase: 2,
      jitter: true,
      ...config
    };
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryCondition?: (error: any) => boolean
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await dbCircuitBreaker.execute(operation);
      } catch (error) {
        lastError = error;

        // Check if we should retry
        if (attempt === this.config.maxRetries) {
          break; // No more retries
        }

        if (retryCondition && !retryCondition(error)) {
          break; // Error condition says don't retry
        }

        if (!this.isRetryableError(error)) {
          break; // Non-retryable error
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);
        console.log(`[DB Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, 
                   error instanceof Error ? error.message : String(error));
        
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private isRetryableError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Connection-related errors that are potentially recoverable
      return message.includes('connection') ||
             message.includes('timeout') ||
             message.includes('network') ||
             message.includes('econnreset') ||
             message.includes('enotfound') ||
             message.includes('etimedout') ||
             message.includes('socket') ||
             message.includes('server has gone away') ||
             message.includes("can't reach database server");
    }
    return false;
  }

  private calculateDelay(attempt: number): number {
    let delay = this.config.baseDelay * Math.pow(this.config.exponentialBase, attempt);
    delay = Math.min(delay, this.config.maxDelay);

    // Add jitter to prevent thundering herd
    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global retry manager instance
export const dbRetryManager = new DatabaseRetryManager({
  maxRetries: process.env.NODE_ENV === 'production' ? 3 : 2,
  baseDelay: 1000,
  maxDelay: process.env.NODE_ENV === 'production' ? 15000 : 5000
});

/**
 * Database operation wrapper with automatic recovery
 */
class DatabaseOperationWrapper {
  static async executeQuery<T>(
    operation: () => Promise<T>,
    operationName = 'database operation'
  ): Promise<T> {
    try {
      return await dbRetryManager.executeWithRetry(operation);
    } catch (error) {
      console.error(`[Database] ${operationName} failed after all retries:`, error);
      
      // Try to trigger recovery
      try {
        await connectionManager.reconnect();
      } catch (recoveryError) {
        console.error('[Database] Recovery attempt failed:', recoveryError);
      }
      
      throw error;
    }
  }

  static async executeTransaction<T>(
    operation: () => Promise<T>,
    operationName = 'database transaction'
  ): Promise<T> {
    return this.executeQuery(async () => {
      return await prisma.$transaction(async (tx) => {
        return await operation();
      }, {
        timeout: 30000, // 30 second timeout for transactions
        isolationLevel: 'ReadCommitted'
      });
    }, operationName);
  }

  static async executeBatch<T>(
    operations: (() => Promise<T>)[],
    operationName = 'batch operations'
  ): Promise<T[]> {
    return this.executeQuery(async () => {
      return await Promise.all(operations.map(op => op()));
    }, operationName);
  }
}

/**
 * Health check and monitoring utilities
 */
export const databaseMonitor = {
  async performHealthCheck(): Promise<{
    healthy: boolean;
    latency: number;
    error?: string;
    circuitBreakerState: string;
  }> {
    const startTime = Date.now();
    
    try {
      await dbCircuitBreaker.execute(async () => {
        await prisma.$queryRaw`SELECT 1 as health_check`;
      });
      
      const latency = Date.now() - startTime;
      return {
        healthy: true,
        latency,
        circuitBreakerState: dbCircuitBreaker.getState().state
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        healthy: false,
        latency,
        error: error instanceof Error ? error.message : String(error),
        circuitBreakerState: dbCircuitBreaker.getState().state
      };
    }
  },

  async getConnectionInfo(): Promise<{
    activeConnections: number;
    maxConnections: number;
    circuitBreaker: any;
  }> {
    try {
      const processlist = await DatabaseOperationWrapper.executeQuery(async () => {
        return await prisma.$queryRaw<Array<{Id: number}>>`SHOW PROCESSLIST`;
      }, 'get connection info');

      const variables = await DatabaseOperationWrapper.executeQuery(async () => {
        return await prisma.$queryRaw<Array<{Variable_name: string; Value: string}>>`
          SHOW VARIABLES WHERE Variable_name IN ('max_connections', 'max_user_connections')
        `;
      }, 'get max connections');

      const maxConnections = variables.find(v => v.Variable_name === 'max_connections')?.Value || 'unknown';

      return {
        activeConnections: processlist.length,
        maxConnections: parseInt(maxConnections as string) || 0,
        circuitBreaker: dbCircuitBreaker.getState()
      };
    } catch (error) {
      console.error('[Database Monitor] Failed to get connection info:', error);
      return {
        activeConnections: -1,
        maxConnections: -1,
        circuitBreaker: dbCircuitBreaker.getState()
      };
    }
  }
};

// Export main utilities
export { DatabaseCircuitBreaker, CircuitBreakerState };
export { DatabaseRetryManager };
export { DatabaseOperationWrapper };