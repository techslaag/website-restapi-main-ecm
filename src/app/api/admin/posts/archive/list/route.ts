import { NextRequest, NextResponse } from 'next/server';
import { ArchiveService } from '@/lib/services/archiveService';
import authMiddleware from '@/lib/auth/authMiddleware';
import { extractQueryParams, forceNumberOrDefault } from '@/lib/utils/index';

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /admin/posts/archive/list:
 *   get:
 *     summary: Get archived posts for admin interface
 *     description: Retrieves archived posts with pagination for admin management
 *     tags:
 *       - Admin
 *       - Posts
 *       - Archive
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Page number (1-based)
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *       - name: limit
 *         in: query
 *         description: Number of posts per page
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Archived posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalCount:
 *                       type: integer
 *                     hasNext:
 *                       type: boolean
 *                     hasPrev:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */

// GET /api/admin/posts/archive/list - Get archived posts using ArchiveService
export async function GET(req: NextRequest) {
  return authMiddleware(req, async (user) => {
    // Verify that the user is admin
    if (!user.admin) {
      console.log(`[ArchiveList] Non-admin user ${user.id} attempted to access archived posts`);
      return NextResponse.json(
        { 
          success: false,
          error: 'Admin access required for archived posts management' 
        },
        { status: 403 }
      );
    }

    try {
      const queryParams = extractQueryParams(req);
      const page = forceNumberOrDefault(queryParams.page, 1);
      const limit = forceNumberOrDefault(queryParams.limit, 20);

      console.log(`[ArchiveList] Admin ${user.id} requested archived posts: page=${page}, limit=${limit}`);

      // Use ArchiveService to get archived posts
      const result = await ArchiveService.getArchivedPosts(page, limit);

      return NextResponse.json({
        success: true,
        data: result.posts,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('[ArchiveList] Error fetching archived posts:', error);
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to fetch archived posts',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  });
}