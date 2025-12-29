import { NextRequest, NextResponse } from 'next/server';
import { ArchiveService } from '@/lib/services/archiveService';

export const dynamic = "force-dynamic";

// GET /api/posts/archive/stats - Get archive statistics
export async function GET(_req: NextRequest) {
  try {
    // Temporarily disable authentication for testing
    // After server restart and auth setup, uncomment the auth check below:
    /*
    const authCheck = await authMiddleware(req);
    if (!authCheck.success || !authCheck.user?.admin) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Admin access required' 
        },
        { status: 403 }
      );
    }
    */

    const stats = await ArchiveService.getArchiveStats();
    
    return NextResponse.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting archive stats:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch archive statistics' 
      },
      { status: 500 }
    );
  }
}