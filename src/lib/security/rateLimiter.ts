import { NextRequest } from "next/server";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
  skipSuccessful?: boolean; // Don't count successful requests
  skipFailed?: boolean; // Don't count failed requests
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
    blocked: boolean;
  };
}

class MemoryRateLimitStore {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 10 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const key in this.store) {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    }
  }

  get(key: string) {
    const entry = this.store[key];
    if (!entry || entry.resetTime < Date.now()) {
      return null;
    }
    return entry;
  }

  set(key: string, count: number, resetTime: number, blocked: boolean = false) {
    this.store[key] = { count, resetTime, blocked };
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number; blocked: boolean } {
    const now = Date.now();
    const entry = this.get(key);
    
    if (!entry) {
      const resetTime = now + windowMs;
      this.set(key, 1, resetTime);
      return { count: 1, resetTime, blocked: false };
    }
    
    const newCount = entry.count + 1;
    this.set(key, newCount, entry.resetTime, entry.blocked);
    return { count: newCount, resetTime: entry.resetTime, blocked: entry.blocked };
  }

  block(key: string, windowMs: number) {
    const now = Date.now();
    const resetTime = now + windowMs;
    this.set(key, 0, resetTime, true);
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store = {};
  }
}

// Global store instance
const store = new MemoryRateLimitStore();

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  blocked?: boolean;
}

export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => getClientIdentifier(req),
    skipSuccessful = false,
    skipFailed = false
  } = config;

  return {
    check: (request: NextRequest): RateLimitResult => {
      const key = keyGenerator(request);
      const result = store.increment(key, windowMs);
      
      // Check if client is currently blocked
      if (result.blocked) {
        const timeUntilReset = Math.ceil((result.resetTime - Date.now()) / 1000);
        return {
          success: false,
          limit: maxRequests,
          remaining: 0,
          resetTime: result.resetTime,
          retryAfter: timeUntilReset,
          blocked: true
        };
      }

      // Check if limit exceeded
      if (result.count > maxRequests) {
        // Block the client for the remainder of the window
        store.block(key, Math.max(0, result.resetTime - Date.now()));
        
        const timeUntilReset = Math.ceil((result.resetTime - Date.now()) / 1000);
        return {
          success: false,
          limit: maxRequests,
          remaining: 0,
          resetTime: result.resetTime,
          retryAfter: timeUntilReset,
          blocked: true
        };
      }

      return {
        success: true,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - result.count),
        resetTime: result.resetTime
      };
    },

    // Method to decrement counter for successful requests (if skipSuccessful is true)
    onSuccess: (request: NextRequest) => {
      if (skipSuccessful) {
        const key = keyGenerator(request);
        const entry = store.get(key);
        if (entry && entry.count > 0) {
          store.set(key, entry.count - 1, entry.resetTime, entry.blocked);
        }
      }
    },

    // Method to decrement counter for failed requests (if skipFailed is true)
    onError: (request: NextRequest) => {
      if (skipFailed) {
        const key = keyGenerator(request);
        const entry = store.get(key);
        if (entry && entry.count > 0) {
          store.set(key, entry.count - 1, entry.resetTime, entry.blocked);
        }
      }
    }
  };
}

function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  let clientIp = forwarded?.split(',')[0] || realIp || cfConnectingIp;
  
  // Fallback to direct IP if no proxy headers
  if (!clientIp) {
    // Note: In production, you should configure your reverse proxy to set proper headers
    clientIp = request.ip || 'unknown';
  }
  
  // Clean and validate IP
  clientIp = clientIp.trim();
  
  // For authenticated requests, you might want to include user ID
  const authorization = request.headers.get('authorization');
  if (authorization) {
    try {
      // Extract user ID from token if needed for per-user rate limiting
      // This is optional - you can use IP-only limiting
      return `${clientIp}`;
    } catch {
      // If token is invalid, fall back to IP-only
    }
  }
  
  return clientIp;
}

// Pre-configured rate limiters for common use cases
export const upgradeRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3, // Maximum 3 upgrade attempts per 15 minutes
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // Maximum 10 auth requests per 15 minutes
});

export const generalApiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // Maximum 100 requests per minute
});

export const paymentRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // Maximum 10 payment attempts per hour
});