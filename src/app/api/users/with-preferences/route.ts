import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/middleware/auth";
import { getUsersWithFcmTokens } from "@/lib/fcm-service";

/**
 * GET /api/users/with-preferences
 * Get users with their preferences and FCM token information
 * 
 * Query params:
 * - limit: number of users to return (default: 1000)
 * - includeInactive: include users without preferences (default: false)
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '1000');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Get users with FCM tokens efficiently using the service
    const usersWithTokens = await getUsersWithFcmTokens();
    
    // Apply limit and transform for API response
    const limitedUsers = usersWithTokens
      .slice(0, limit)
      .map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        admin: user.admin,
        createdAt: new Date(), // We don't have this in the service, using current date
        preferences: user.preferences,
        fcmTokens: user.tokens,
        hasToken: user.hasToken,
        tokenPreview: user.tokenPreview,
        categories: user.categories,
        deviceCount: user.deviceCount
      }));

    return NextResponse.json({
      success: true,
      source: 'fcm_token_table',
      users: limitedUsers,
      count: limitedUsers.length
    });

  } catch (error) {
    console.error("Error fetching users with preferences:", error);
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

function parseCategories(categoriesStr: string): string[] {
  try {
    if (!categoriesStr) return [];
    
    // Try to parse as JSON array first
    try {
      const parsed = JSON.parse(categoriesStr);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // If JSON parse fails, try comma-separated values
      return categoriesStr.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
    }
    
    return [];
  } catch (error) {
    console.error('Error parsing categories:', error);
    return [];
  }
}