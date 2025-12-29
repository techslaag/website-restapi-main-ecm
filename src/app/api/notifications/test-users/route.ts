import { NextRequest, NextResponse } from "next/server";
import { getUsersWithFcmTokens } from "@/lib/fcm-service";

// Simple test endpoint to debug user fetching without authentication
export async function GET(request: NextRequest) {
  try {
    const users = await getUsersWithFcmTokens();
    
    return NextResponse.json({
      success: true,
      userCount: users.length,
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        tokenCount: user.tokens.length,
        deviceCount: user.deviceCount,
        hasToken: user.hasToken
      }))
    });
  } catch (error) {
    console.error("Test users error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}