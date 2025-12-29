import { NextRequest } from "next/server";

interface RequestLock {
  userId: string;
  operation: string;
  timestamp: number;
  expiresAt: number;
}

class MemoryLockStore {
  private locks: Map<string, RequestLock> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired locks every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    const keysToDelete: string[] = [];
    this.locks.forEach((lock, key) => {
      if (lock.expiresAt < now) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.locks.delete(key));
  }

  acquireLock(key: string, userId: string, operation: string, ttlMs: number): boolean {
    const now = Date.now();
    const existingLock = this.locks.get(key);
    
    // Check if lock exists and is still valid
    if (existingLock && existingLock.expiresAt > now) {
      return false; // Lock already exists
    }
    
    // Create new lock
    const lock: RequestLock = {
      userId,
      operation,
      timestamp: now,
      expiresAt: now + ttlMs
    };
    
    this.locks.set(key, lock);
    return true;
  }

  releaseLock(key: string): boolean {
    return this.locks.delete(key);
  }

  getLock(key: string): RequestLock | undefined {
    const lock = this.locks.get(key);
    if (lock && lock.expiresAt > Date.now()) {
      return lock;
    }
    // Remove expired lock
    if (lock) {
      this.locks.delete(key);
    }
    return undefined;
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.locks.clear();
  }
}

// Global lock store
const lockStore = new MemoryLockStore();

export interface DeduplicationResult {
  success: boolean;
  lockKey?: string;
  existingLock?: RequestLock;
  message?: string;
}

export class RequestDeduplicator {
  private operation: string;
  private ttlMs: number;

  constructor(operation: string, ttlMs: number = 30000) { // Default 30 seconds
    this.operation = operation;
    this.ttlMs = ttlMs;
  }

  /**
   * Try to acquire a lock for the given user and operation
   */
  acquireLock(userId: string, additionalKey?: string): DeduplicationResult {
    const lockKey = this.generateLockKey(userId, additionalKey);
    const acquired = lockStore.acquireLock(lockKey, userId, this.operation, this.ttlMs);
    
    if (!acquired) {
      const existingLock = lockStore.getLock(lockKey);
      return {
        success: false,
        lockKey,
        existingLock,
        message: `Operation "${this.operation}" already in progress for user ${userId}`
      };
    }
    
    return {
      success: true,
      lockKey
    };
  }

  /**
   * Release a lock
   */
  releaseLock(userId: string, additionalKey?: string): boolean {
    const lockKey = this.generateLockKey(userId, additionalKey);
    return lockStore.releaseLock(lockKey);
  }

  /**
   * Check if a lock exists for the given user
   */
  hasLock(userId: string, additionalKey?: string): boolean {
    const lockKey = this.generateLockKey(userId, additionalKey);
    return lockStore.getLock(lockKey) !== undefined;
  }

  /**
   * Get lock information
   */
  getLockInfo(userId: string, additionalKey?: string): RequestLock | undefined {
    const lockKey = this.generateLockKey(userId, additionalKey);
    return lockStore.getLock(lockKey);
  }

  private generateLockKey(userId: string, additionalKey?: string): string {
    const parts = [this.operation, userId];
    if (additionalKey) {
      parts.push(additionalKey);
    }
    return parts.join(':');
  }
}

// Pre-configured deduplicators for common operations
export const subscriptionUpgradeDeduplicator = new RequestDeduplicator('subscription-upgrade', 60000); // 1 minute
export const paymentDeduplicator = new RequestDeduplicator('payment-processing', 300000); // 5 minutes
export const subscriptionCreateDeduplicator = new RequestDeduplicator('subscription-create', 60000); // 1 minute

/**
 * Middleware wrapper that automatically handles request deduplication
 */
export function withDeduplication<T>(
  deduplicator: RequestDeduplicator,
  getUserId: (req: NextRequest) => string,
  getAdditionalKey?: (req: NextRequest) => string
) {
  return function(handler: (req: NextRequest, ...args: any[]) => Promise<T>) {
    return async function(req: NextRequest, ...args: any[]): Promise<T> {
      const userId = getUserId(req);
      const additionalKey = getAdditionalKey ? getAdditionalKey(req) : undefined;
      
      // Try to acquire lock
      const lockResult = deduplicator.acquireLock(userId, additionalKey);
      
      if (!lockResult.success) {
        const timeRemaining = lockResult.existingLock 
          ? Math.ceil((lockResult.existingLock.expiresAt - Date.now()) / 1000)
          : 0;
          
        throw new Error(`Request already in progress. Please wait ${timeRemaining} seconds before trying again.`);
      }
      
      try {
        // Execute the handler
        const result = await handler(req, ...args);
        return result;
      } finally {
        // Always release the lock when done
        deduplicator.releaseLock(userId, additionalKey);
      }
    };
  };
}

/**
 * Utility to create idempotency keys
 */
export function generateIdempotencyKey(userId: string, operation: string, data?: any): string {
  const timestamp = Date.now();
  const dataHash = data ? JSON.stringify(data) : '';
  return `${operation}:${userId}:${timestamp}:${Buffer.from(dataHash).toString('base64url')}`;
}

/**
 * Idempotency store for tracking completed operations
 */
class IdempotencyStore {
  private store: Map<string, { result: any; timestamp: number; expiresAt: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000); // Cleanup every minute
  }

  private cleanup() {
    const now = Date.now();
    const keysToDelete: string[] = [];
    this.store.forEach((entry, key) => {
      if (entry.expiresAt < now) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.store.delete(key));
  }

  set(key: string, result: any, ttlMs: number = 24 * 60 * 60 * 1000) { // Default 24 hours
    const now = Date.now();
    this.store.set(key, {
      result,
      timestamp: now,
      expiresAt: now + ttlMs
    });
  }

  get(key: string): any | undefined {
    const entry = this.store.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.result;
    }
    if (entry) {
      this.store.delete(key);
    }
    return undefined;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

export const idempotencyStore = new IdempotencyStore();