import { NextRequest } from "next/server";
import * as jwt from 'jsonwebtoken';
import prisma from "@/lib/prisma";

export interface AuthResult {
  success: boolean;
  user?: any;
  error?: string;
}


export async function validateJWT(token: string): Promise<AuthResult> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return { success: false, error: "JWT secret not configured" };
    }

    const payload = jwt.verify(token, secret) as any;
    
    // Get current user data
    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
      },
      select: {
        id: true,
        email: true,
        admin: true
      }
    });

    if (!user) {
      return { success: false, error: "User not found or deactivated" };
    }

    // Check if token is still valid (not expired)
    const tokenRecord = await prisma.session.findFirst({
      where: {
        userId: user.id,
        sessionToken: token,
        expires: {
          gte: new Date()
        }
      }
    });

    if (!tokenRecord) {
      return { success: false, error: "Token revoked or expired" };
    }

    return { success: true, user };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return { success: false, error: "Invalid token" };
    }
    if (error instanceof jwt.TokenExpiredError) {
      return { success: false, error: "Token expired" };
    }
    
    console.error("JWT validation error:", error);
    return { success: false, error: "Authentication error" };
  }
}

export async function requireAdminAuth(request: NextRequest): Promise<AuthResult> {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return { success: false, error: "Bearer token authentication required" };
    }

    // JWT authentication only
    const token = authHeader.substring(7);
    const authResult = await validateJWT(token);

    if (!authResult.success) {
      return authResult;
    }

    // Check admin permissions
    if (!hasAdminPermission(authResult.user)) {
      return { success: false, error: "Admin privileges required" };
    }

    return authResult;
  } catch (error) {
    console.error("Admin authentication error:", error);
    return { success: false, error: "Authentication error" };
  }
}

export async function requireNotificationPermission(request: NextRequest): Promise<AuthResult> {
  const authResult = await requireAdminAuth(request);
  
  if (!authResult.success) {
    return authResult;
  }

  // Check specific notification permissions
  if (!hasNotificationPermission(authResult.user)) {
    return { success: false, error: "Notification management permission required" };
  }

  return authResult;
}

function hasAdminPermission(user: any): boolean {
  return user.admin === true;
}

function hasNotificationPermission(user: any): boolean {
  return user.admin === true;
}

/**
 * Validate API key for service-to-service communication
 */
export async function validateApiKey(request: NextRequest): Promise<AuthResult> {
  try {
    const apiKey = request.headers.get('x-api-key') || 
                   request.headers.get('authorization')?.replace('Bearer ', '');
    
    const expectedApiKey = process.env.API_KEY || process.env.INTERNAL_API_KEY;
    
    if (!expectedApiKey) {
      // For development, allow requests without API key validation
      if (process.env.NODE_ENV === 'development' || !process.env.API_KEY) {
        return { success: true, user: { id: 'system', admin: true } };
      }
      return { success: false, error: "API key validation not configured" };
    }

    if (!apiKey) {
      // For development, allow requests without API key
      if (process.env.NODE_ENV === 'development') {
        return { success: true, user: { id: 'system', admin: true } };
      }
      return { success: false, error: "API key required" };
    }

    if (apiKey !== expectedApiKey) {
      return { success: false, error: "Invalid API key" };
    }

    return { success: true, user: { id: 'system', role: 'api' } };
  } catch (error) {
    return { success: false, error: "API key validation failed" };
  }
}

/**
 * Require basic authentication (JWT or API key)
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  // Try API key first
  const apiResult = await validateApiKey(request);
  if (apiResult.success) {
    return apiResult;
  }

  // Fallback to JWT validation
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return await validateJWT(token);
  }

  return { success: false, error: "Authentication required" };
}

export async function logAuthAttempt(
  request: NextRequest, 
  result: AuthResult, 
  action: string
): Promise<void> {
  try {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Log to console instead of database
    console.log(`[AUTH] ${action} - ${result.success ? 'SUCCESS' : 'FAILED'}`, {
      userId: result.user?.id || null,
      ip,
      userAgent: userAgent.substring(0, 100), // Truncate long user agents
      error: result.error || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Auth logging error:", error);
  }
}