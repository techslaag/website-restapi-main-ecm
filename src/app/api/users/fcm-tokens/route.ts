import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateApiKey, requireAuth } from "@/lib/middleware/auth";

/**
 * GET /api/users/fcm-tokens
 * Get FCM tokens for specified users or all users
 * 
 * Query params:
 * - userIds: comma-separated user IDs (optional)
 * - limit: number of tokens to return (default: 1000)
 * - activeOnly: boolean to return only active tokens (default: true)
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication (could be API key or user auth depending on use case)
    const authResult = await validateApiKey(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userIdsParam = searchParams.get('userIds');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    const userIds = userIdsParam ? userIdsParam.split(',') : undefined;

    // Build where clause
    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }
    if (userIds && userIds.length > 0) {
      where.userId = { in: userIds };
    }

    // Use FcmToken table exclusively
    const tokens = await prisma.fcmToken.findMany({
      where,
      select: {
        token: true,
        userId: true,
        deviceId: true,
        platform: true,
        appVersion: true,
        isActive: true,
        lastUsed: true
      },
      orderBy: { lastUsed: 'desc' },
      take: limit
    });

    return NextResponse.json({
      success: true,
      source: 'fcm_token_table',
      tokens: tokens.map(t => t.token),
      details: tokens,
      count: tokens.length
    });

  } catch (error) {
    console.error("Error fetching FCM tokens:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Server error",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users/fcm-tokens
 * Add or update FCM tokens for users
 * 
 * Request body:
 * {
 *   "operations": [
 *     {
 *       "userId": "string",
 *       "token": "string",
 *       "deviceId": "string" (optional),
 *       "platform": "ios|android|web" (optional),
 *       "appVersion": "string" (optional)
 *     }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const { operations } = await request.json();

    if (!Array.isArray(operations) || operations.length === 0) {
      return NextResponse.json(
        { error: "Operations array is required" },
        { status: 400 }
      );
    }

    const results = [];
    
    for (const op of operations) {
      const { userId, token, deviceId, platform, appVersion } = op;
      
      if (!userId || !token) {
        results.push({
          userId,
          success: false,
          error: "userId and token are required"
        });
        continue;
      }

      try {
        // Try to upsert in FcmToken table
        const existing = await prisma.fcmToken.findUnique({
          where: { token }
        });

        if (existing) {
          // Update existing token
          await prisma.fcmToken.update({
            where: { token },
            data: {
              userId,
              deviceId: deviceId || existing.deviceId,
              platform: platform || existing.platform,
              appVersion: appVersion || existing.appVersion,
              isActive: true,
              lastUsed: new Date()
            }
          });
        } else {
          // Create new token
          await prisma.fcmToken.create({
            data: {
              userId,
              token,
              deviceId,
              platform,
              appVersion,
              isActive: true,
              lastUsed: new Date()
            }
          });
        }

        results.push({
          userId,
          token: token.substring(0, 20) + '...',
          success: true,
          action: existing ? 'updated' : 'created'
        });

      } catch (error) {
        results.push({
          userId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    return NextResponse.json({
      success: successCount > 0,
      message: `Processed ${operations.length} operations, ${successCount} successful`,
      results
    });

  } catch (error) {
    console.error("Error processing FCM token operations:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Server error" 
      },
      { status: 500 }
    );
  }
}