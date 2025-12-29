import { NextRequest, NextResponse } from 'next/server';
import { ArchiveService } from '@/lib/services/archiveService';
import authMiddleware from '@/lib/auth/authMiddleware';

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /admin/posts/archive/stats:
 *   get:
 *     summary: Get archive statistics for admin interface
 *     description: Retrieves comprehensive archive statistics for admin dashboard
 *     tags:
 *       - Admin
 *       - Posts
 *       - Archive
 *       - Statistics
 *     responses:
 *       200:
 *         description: Archive statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalPosts:
 *                       type: integer
 *                       description: Total number of posts (all statuses)
 *                     publishedPosts:
 *                       type: integer
 *                       description: Number of published posts
 *                     archivedCount:
 *                       type: integer
 *                       description: Number of archived posts
 *                     activeCount:
 *                       type: integer
 *                       description: Number of active (non-archived) posts
 *                     recentlyArchived:
 *                       type: integer
 *                       description: Posts archived in the last 7 days
 *                     archivePercentage:
 *                       type: string
 *                       description: Percentage of posts that are archived
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */

// GET /api/admin/posts/archive/stats - Get archive statistics using ArchiveService
export async function GET(req: NextRequest) {
  return authMiddleware(req, async (user) => {
    // Verify that the user is admin
    if (!user.admin) {
      console.log(`[ArchiveStats] Non-admin user ${user.id} attempted to access archive stats`);
      return NextResponse.json(
        { 
          success: false,
          error: 'Admin access required for archive statistics' 
        },
        { status: 403 }
      );
    }

    try {
      console.log(`[ArchiveStats] Admin ${user.id} requested archive statistics`);

      // Use ArchiveService to get archive statistics
      const stats = await ArchiveService.getArchiveStats();

      return NextResponse.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('[ArchiveStats] Error fetching archive statistics:', error);
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to fetch archive statistics',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  });
}