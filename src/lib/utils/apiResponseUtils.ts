import { NextResponse } from 'next/server';

// Standard CORS headers for all API responses
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

// Standard error response structure
export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  details?: any;
  timestamp?: string;
}

// Standard success response structure
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    [key: string]: any;
  };
  timestamp?: string;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string,
  status: number = 500,
  details?: any
): NextResponse<ApiErrorResponse> {
  const errorResponse: ApiErrorResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };

  if (details) {
    if (details instanceof Error) {
      errorResponse.message = details.message;
      if (process.env.NODE_ENV === 'development') {
        errorResponse.details = {
          stack: details.stack,
          name: details.name,
        };
      }
    } else {
      errorResponse.details = details;
    }
  }

  return NextResponse.json(errorResponse, {
    status,
    headers: CORS_HEADERS,
  });
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: ApiSuccessResponse<T>['meta']
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  if (meta) {
    response.meta = meta;
  }

  return NextResponse.json(response, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export function handleOptionsRequest(): NextResponse {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

/**
 * Validate required query parameters
 */
export function validateQueryParams(
  params: Record<string, any>,
  required: string[]
): { valid: boolean; missing?: string[] } {
  const missing = required.filter(param => !params[param]);
  return {
    valid: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined,
  };
}

/**
 * Parse date parameters with validation
 */
export function parseDateParams(params: {
  start_date?: string;
  end_date?: string;
}): {
  startDate: Date;
  endDate: Date;
  error?: string;
} {
  const now = new Date();
  let startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days ago
  let endDate = now;

  if (params.start_date) {
    const parsed = new Date(params.start_date);
    if (isNaN(parsed.getTime())) {
      return { startDate, endDate, error: 'Invalid start_date format' };
    }
    startDate = parsed;
  }

  if (params.end_date) {
    const parsed = new Date(params.end_date);
    if (isNaN(parsed.getTime())) {
      return { startDate, endDate, error: 'Invalid end_date format' };
    }
    endDate = parsed;
  }

  // Ensure end date is not before start date
  if (endDate < startDate) {
    return { startDate, endDate, error: 'end_date cannot be before start_date' };
  }

  // Ensure dates are not in the future
  if (startDate > now) {
    startDate = now;
  }
  if (endDate > now) {
    endDate = now;
  }

  return { startDate, endDate };
}