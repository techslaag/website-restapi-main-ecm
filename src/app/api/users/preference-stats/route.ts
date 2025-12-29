import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/middleware/auth";
import { getFcmStatistics } from "@/lib/fcm-service";

/**
 * GET /api/users/preference-stats
 * Get user preference statistics for notifications
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const authResult = await validateApiKey(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    // Get all statistics efficiently using the service
    const stats = await getFcmStatistics();

    return NextResponse.json({
      success: true,
      source: 'fcm_token_table',
      stats
    });

  } catch (error) {
    console.error("Error fetching preference stats:", error);
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