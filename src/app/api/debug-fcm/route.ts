import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Get all active FCM tokens with user information
    const allTokens = await prisma.fcmToken.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { lastUsed: 'desc' }
    });

    // Get count of tokens with orphaned users (no corresponding user record)
    const nullUserTokens = await prisma.fcmToken.count({
      where: { 
        isActive: true,
        NOT: {
          user: {}
        }
      }
    });

    // Get count of tokens with valid users
    const validUserTokens = await prisma.fcmToken.count({
      where: { 
        isActive: true,
        user: {}
      }
    });

    // Group by userId to understand the distribution
    const userTokenCounts = await prisma.fcmToken.groupBy({
      by: ['userId'],
      where: { isActive: true },
      _count: { userId: true }
    });

    return NextResponse.json({
      summary: {
        totalActiveTokens: allTokens.length,
        tokensWithNullUsers: nullUserTokens,
        tokensWithValidUsers: validUserTokens,
        uniqueUsers: userTokenCounts.length
      },
      userTokenCounts: userTokenCounts.map(group => ({
        userId: group.userId,
        tokenCount: group._count.userId
      })),
      tokenDetails: allTokens.map(token => ({
        id: token.id,
        tokenPreview: token.token.substring(0, 20) + '...',
        userId: token.userId,
        user: token.user ? {
          id: token.user.id,
          name: token.user.name,
          email: token.user.email
        } : null,
        platform: token.platform,
        lastUsed: token.lastUsed
      }))
    });
  } catch (error) {
    console.error("Debug FCM error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}