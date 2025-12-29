import { NextRequest, NextResponse } from 'next/server';
import { ArchiveService } from '@/lib/services/archiveService';
import authMiddleware from '@/lib/auth/authMiddleware';
import { serializeError } from 'serialize-error';
import prisma from '@/lib/prisma';

/**
 * @swagger
 * /admin/posts/archive/bulk:
 *   post:
 *     summary: Archive all unarchived posts (Admin only)
 *     description: Archives ALL unarchived posts regardless of age. This is a powerful operation that should be used carefully.
 *     tags:
 *       - Admin
 *       - Posts
 *       - Archive
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               setAsExclusivity:
 *                 type: boolean
 *                 description: Whether to set archived posts as premium content (ecomembre)
 *                 default: true
 *               addArchiveTag:
 *                 type: boolean
 *                 description: Whether to add "Archive" tag to archived posts
 *                 default: true
 *               maxPosts:
 *                 type: number
 *                 description: Maximum number of posts to archive (safety limit)
 *                 default: 50000
 *                 minimum: 1
 *                 maximum: 100000
 *               confirm:
 *                 type: boolean
 *                 description: Confirmation required for this operation
 *                 default: false
 *     responses:
 *       200:
 *         description: Bulk archive operation completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     archivedCount:
 *                       type: number
 *                     samplePosts:
 *                       type: array
 *                       items:
 *                         type: string
 *                     timestamp:
 *                       type: string
 *                     operation:
 *                       type: string
 *       400:
 *         description: Confirmation required or invalid parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return authMiddleware(request, async (user) => {
    // Verify that the user is admin
    if (!user.admin) {
      console.log(`[BulkArchive] Non-admin user ${user.id} attempted bulk archive operation`);
      return NextResponse.json(
        { 
          success: false,
          error: 'Admin access required for bulk archive operations' 
        },
        { status: 403 }
      );
    }

    try {
      const body = await request.json().catch(() => ({}));
      
      // Extract parameters with defaults
      const setAsExclusivity = body.setAsExclusivity ?? true;
      const addArchiveTag = body.addArchiveTag ?? true;
      const maxPosts = Math.min(Math.max(body.maxPosts ?? 50000, 1), 100000); // Clamp between 1 and 100k
      const confirm = body.confirm ?? false;
      
      // Require explicit confirmation for this powerful operation
      if (!confirm) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Confirmation required for bulk archive operation',
            message: 'This operation will archive ALL unarchived posts. Set "confirm": true to proceed.',
            warning: 'This operation cannot be easily undone and will affect all public posts.'
          },
          { status: 400 }
        );
      }

      console.log(`[BulkArchive] Admin ${user.id} (${user.email}) initiated bulk archive operation`);
      console.log(`[BulkArchive] Parameters: setAsExclusivity=${setAsExclusivity}, addArchiveTag=${addArchiveTag}, maxPosts=${maxPosts}`);
      
      // Perform the bulk archive operation
      const startTime = Date.now();
      const result = await ArchiveService.archiveAllPosts(setAsExclusivity, addArchiveTag, maxPosts);
      const duration = Date.now() - startTime;
      
      const logMessage = `Bulk archive completed: ${result.count} posts archived in ${duration}ms`;
      console.log(`[BulkArchive] ${logMessage}`);
      
      // Log some sample posts that were archived
      if (result.posts.length > 0) {
        console.log(`[BulkArchive] Sample archived posts:`, result.posts.slice(0, 5));
      }

      // Create audit log entry (if audit logging exists)
      try {
        // This could be enhanced with a proper audit logging system
        console.log(`[BulkArchive] AUDIT: User ${user.id} (${user.email}) archived ${result.count} posts at ${new Date().toISOString()}`);
      } catch (auditError) {
        console.warn('[BulkArchive] Failed to create audit log:', auditError);
        // Don't fail the operation if audit logging fails
      }

      return NextResponse.json({
        success: true,
        message: logMessage,
        data: {
          archivedCount: result.count,
          samplePosts: result.posts,
          timestamp: new Date().toISOString(),
          operation: 'bulk_archive_all',
          duration: `${duration}ms`,
          settings: {
            setAsExclusivity,
            addArchiveTag,
            maxPosts
          }
        }
      });
      
    } catch (error) {
      console.error('[BulkArchive] Bulk archive operation failed:', error);
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Bulk archive operation failed',
          details: error instanceof Error ? error.message : 'Unknown error',
          operation: 'bulk_archive_all',
          timestamp: new Date().toISOString(),
          ...(process.env.NODE_ENV === "development" ? serializeError(error) : {})
        },
        { status: 500 }
      );
    }
  });
}

/**
 * @swagger
 * /admin/posts/archive/bulk:
 *   get:
 *     summary: Get preview of posts that would be archived (Admin only)
 *     description: Returns count and preview of posts that would be archived without actually archiving them
 *     tags:
 *       - Admin
 *       - Posts
 *       - Archive
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Number of sample posts to return in preview
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Archive preview data
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
 *                     totalUnarchived:
 *                       type: number
 *                     samplePosts:
 *                       type: array
 *                     timestamp:
 *                       type: string
 *       403:
 *         description: Admin access required
 */
export async function GET(request: NextRequest) {
  return authMiddleware(request, async (user) => {
    // Verify that the user is admin
    if (!user.admin) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Admin access required' 
        },
        { status: 403 }
      );
    }

    try {
      const { searchParams } = new URL(request.url);
      const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10'), 1), 100);

      // Get preview of posts that would be archived
      const previewPosts = await prisma.$queryRaw`
        SELECT ID, post_title, post_date_gmt, post_author
        FROM mod180_posts 
        WHERE post_type = 'post' 
        AND post_status = 'publish'
        AND NOT (archived = TRUE AND archivedAt IS NOT NULL)
        ORDER BY post_date_gmt DESC
        LIMIT ${limit}
      `;

      const totalResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM mod180_posts 
        WHERE post_type = 'post' 
        AND post_status = 'publish'
        AND NOT (archived = TRUE AND archivedAt IS NOT NULL)
      `;

      const totalUnarchived = Array.isArray(totalResult) && totalResult[0] 
        ? Number(totalResult[0].count) 
        : 0;

      const samplePosts = Array.isArray(previewPosts) 
        ? previewPosts.map(post => ({
            ID: post.ID.toString(),
            title: post.post_title,
            date: post.post_date_gmt,
            author: post.post_author
          }))
        : [];

      console.log(`[BulkArchive] Preview requested by admin ${user.id}: ${totalUnarchived} posts would be archived`);

      return NextResponse.json({
        success: true,
        data: {
          totalUnarchived,
          samplePosts,
          timestamp: new Date().toISOString(),
          warning: 'This preview shows posts that would be archived in a bulk operation'
        }
      });

    } catch (error) {
      console.error('[BulkArchive] Preview operation failed:', error);
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Preview operation failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  });
}