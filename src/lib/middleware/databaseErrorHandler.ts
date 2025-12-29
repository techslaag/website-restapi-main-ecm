import { NextRequest, NextResponse } from "next/server";
import { DatabaseOperationWrapper } from "@/lib/database/connectionRecovery";

/**
 * Database error handling middleware for API routes
 * Provides graceful degradation and user-friendly error responses
 */

export interface DatabaseErrorHandlerOptions {
  fallbackResponse?: any;
  enableRetries?: boolean;
  enableFallback?: boolean;
  enableLogging?: boolean;
}

/**
 * Enhanced error messages for different types of database issues
 */
const getErrorResponse = (error: any, options: DatabaseErrorHandlerOptions) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  
  // Connection errors
  if (message.includes('connection') || 
      message.includes('network') || 
      message.includes("can't reach database server") ||
      message.includes('econnreset') ||
      message.includes('etimedout')) {
    return {
      success: false,
      error: "Database temporarily unavailable",
      message: "Our servers are experiencing connectivity issues. Please try again in a few moments.",
      code: "CONNECTION_ERROR",
      retryAfter: 30,
      fallback: options.enableFallback && options.fallbackResponse ? options.fallbackResponse : undefined
    };
  }

  // Timeout errors
  if (message.includes('timeout')) {
    return {
      success: false,
      error: "Request timeout",
      message: "The request took too long to process. Please try again.",
      code: "TIMEOUT_ERROR",
      retryAfter: 10
    };
  }

  // Transaction errors
  if (message.includes('deadlock') || message.includes('lock')) {
    return {
      success: false,
      error: "Resource temporarily locked",
      message: "The requested resource is temporarily unavailable. Please try again.",
      code: "LOCK_ERROR",
      retryAfter: 5
    };
  }

  // Circuit breaker errors
  if (message.includes('circuit breaker')) {
    return {
      success: false,
      error: "Service temporarily unavailable",
      message: "Our database service is temporarily offline for maintenance. Please try again later.",
      code: "CIRCUIT_BREAKER_OPEN",
      retryAfter: 60
    };
  }

  // Generic database errors
  return {
    success: false,
    error: "Database error",
    message: "We encountered an unexpected issue. Please try again.",
    code: "DATABASE_ERROR",
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  };
};

/**
 * Wrap database operations with comprehensive error handling
 */
export function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  options: DatabaseErrorHandlerOptions = {}
) {
  const defaultOptions: DatabaseErrorHandlerOptions = {
    enableRetries: true,
    enableFallback: true,
    enableLogging: true,
    ...options
  };

  return async (): Promise<T> => {
    try {
      if (defaultOptions.enableRetries) {
        return await DatabaseOperationWrapper.executeQuery(operation);
      } else {
        return await operation();
      }
    } catch (error) {
      if (defaultOptions.enableLogging) {
        console.error('[Database Error Handler] Operation failed:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
      }

      // If fallback is enabled and available, return fallback response
      if (defaultOptions.enableFallback && defaultOptions.fallbackResponse) {
        if (defaultOptions.enableLogging) {
          console.log('[Database Error Handler] Returning fallback response');
        }
        return defaultOptions.fallbackResponse;
      }

      throw error;
    }
  };
}

/**
 * API route wrapper for database error handling
 */
export function withApiDatabaseErrorHandling<T = any>(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse<T>>,
  options: DatabaseErrorHandlerOptions = {}
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse<any>> => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      const errorResponse = getErrorResponse(error, options);
      
      if (options.enableLogging !== false) {
        console.error('[API Database Error]', {
          url: req.url,
          method: req.method,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
      }

      const response = NextResponse.json(errorResponse, {
        status: errorResponse.code === 'CONNECTION_ERROR' ? 503 :
                errorResponse.code === 'TIMEOUT_ERROR' ? 408 :
                errorResponse.code === 'CIRCUIT_BREAKER_OPEN' ? 503 :
                500
      });

      // Add retry headers where appropriate
      if (errorResponse.retryAfter) {
        response.headers.set('Retry-After', errorResponse.retryAfter.toString());
      }

      // Add CORS headers if needed
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Cache-Control', 'no-store');

      return response;
    }
  };
}

/**
 * Transaction wrapper with error handling
 */
export async function withTransactionErrorHandling<T>(
  operation: () => Promise<T>,
  operationName = 'database transaction'
): Promise<T> {
  try {
    return await DatabaseOperationWrapper.executeTransaction(operation, operationName);
  } catch (error) {
    console.error(`[Transaction Error] ${operationName} failed:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    throw error;
  }
}

/**
 * Batch operation wrapper with error handling
 */
export async function withBatchErrorHandling<T>(
  operations: (() => Promise<T>)[],
  operationName = 'batch operations',
  continueOnError = false
): Promise<(T | Error)[]> {
  if (continueOnError) {
    // Execute all operations and return both successes and errors
    return Promise.allSettled(operations.map(async (op, index) => {
      try {
        return await DatabaseOperationWrapper.executeQuery(op, `${operationName} #${index + 1}`);
      } catch (error) {
        console.error(`[Batch Error] Operation ${index + 1} failed:`, error);
        return error instanceof Error ? error : new Error(String(error));
      }
    })).then(results => results.map(result => 
      result.status === 'fulfilled' ? result.value : result.reason
    ));
  } else {
    // Stop on first error
    try {
      return await DatabaseOperationWrapper.executeBatch(operations, operationName);
    } catch (error) {
      console.error(`[Batch Error] ${operationName} failed:`, error);
      throw error;
    }
  }
}

/**
 * Create fallback responses for common API patterns
 */
export const createFallbackResponses = {
  emptyList: (message = "Data temporarily unavailable") => ({
    success: true,
    data: [],
    pagination: {
      currentPage: 1,
      totalPages: 0,
      totalItems: 0,
      hasNext: false,
      hasPrev: false
    },
    message,
    fallback: true
  }),

  emptyObject: (message = "Data temporarily unavailable") => ({
    success: true,
    data: null,
    message,
    fallback: true
  }),

  cachedResponse: (cachedData: any, message = "Serving cached data due to database issues") => ({
    success: true,
    data: cachedData,
    message,
    cached: true,
    fallback: true
  }),

  errorWithRetry: (retryAfter = 30) => ({
    success: false,
    error: "Service temporarily unavailable",
    message: "Please try again in a few moments",
    retryAfter,
    fallback: true
  })
};

/**
 * Database health check middleware
 */
export function requireHealthyDatabase() {
  return async (req: NextRequest, handler: Function) => {
    try {
      // Quick health check before proceeding
      await DatabaseOperationWrapper.executeQuery(async () => {
        // Simple query to test connection
        return;
      }, 'health check');
      
      return await handler(req);
    } catch (error) {
      console.error('[Health Check] Database unhealthy, rejecting request:', error);
      
      return NextResponse.json({
        success: false,
        error: "Service temporarily unavailable",
        message: "Database service is currently unavailable. Please try again later.",
        code: "SERVICE_UNAVAILABLE"
      }, { 
        status: 503,
        headers: {
          'Retry-After': '60',
          'Cache-Control': 'no-store'
        }
      });
    }
  };
}

// Export utility types
export type DatabaseErrorResponse = ReturnType<typeof getErrorResponse>;
export type FallbackResponse = ReturnType<typeof createFallbackResponses.emptyList>;