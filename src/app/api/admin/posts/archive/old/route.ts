import { NextRequest, NextResponse } from 'next/server';
import { ArchiveService } from '@/lib/services/archiveService';
import authMiddleware from '@/lib/auth/authMiddleware';
import { serializeError } from 'serialize-error';

/**
 * @swagger
 * /admin/posts/archive/old:
 *   post:
 *     summary: Archive old posts (30+ days) - Admin only
 *     description: Archives posts older than 30 days. This is the safe archiving operation.
 *     tags:
 *       - Admin
 *       - Posts
 *       - Archive
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               confirm:
 *                 type: boolean
 *                 description: Confirmation required for this operation
 *                 default: false
 *               setAsExclusivity:
 *                 type: boolean
 *                 description: Whether to set archived posts as premium content (ecomembre)
 *                 default: true
 *               addArchiveTag:
 *                 type: boolean
 *                 description: Whether to add "Archive" tag to archived posts
 *                 default: true
 *               olderThanDays:
 *                 type: number
 *                 description: Number of days old posts should be to be archived
 *                 default: 30
 *                 minimum: 1
 *                 maximum: 365
 *     responses:
 *       200:
 *         description: Archive operation completed
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
      console.log(`[ArchiveOld] Non-admin user ${user.id} attempted archive operation`);
      return NextResponse.json(
        { 
          success: false,
          error: 'Admin access required for archive operations' 
        },
        { status: 403 }
      );
    }

    try {
      const body = await request.json().catch(() => ({}));
      
      // Extract parameters with defaults
      const setAsExclusivity = body.setAsExclusivity ?? true;
      const addArchiveTag = body.addArchiveTag ?? true;
      const olderThanDays = Math.min(Math.max(body.olderThanDays ?? 30, 1), 365); // Clamp between 1 and 365 days
      const confirm = body.confirm ?? false;
      
      // Require explicit confirmation
      if (!confirm) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Confirmation required for archive operation',
            message: `This operation will archive posts older than ${olderThanDays} days. Set "confirm": true to proceed.`,
            info: `Posts will be made premium content (ecomembre) with price 5€`
          },
          { status: 400 }
        );
      }

      console.log(`[ArchiveOld] Admin ${user.id} (${user.email}) initiated archive operation for posts older than ${olderThanDays} days`);
      console.log(`[ArchiveOld] Parameters: setAsExclusivity=${setAsExclusivity}, addArchiveTag=${addArchiveTag}`);
      
      // Perform the archive operation
      const startTime = Date.now();
      const result = await ArchiveService.archiveOldPosts(olderThanDays, setAsExclusivity, addArchiveTag);
      const duration = Date.now() - startTime;
      
      const logMessage = `Archive operation completed: ${result.count} posts archived in ${duration}ms`;
      console.log(`[ArchiveOld] ${logMessage}`);
      
      // Log some sample posts that were archived
      if (result.posts.length > 0) {
        console.log(`[ArchiveOld] Sample archived posts:`, result.posts.slice(0, 3));
      } else {
        console.log(`[ArchiveOld] No posts were archived (all current posts are either already archived or newer than ${olderThanDays} days)`);
      }

      // Create audit log entry
      try {
        console.log(`[ArchiveOld] AUDIT: User ${user.id} (${user.email}) archived ${result.count} posts older than ${olderThanDays} days at ${new Date().toISOString()}`);
      } catch (auditError) {
        console.warn('[ArchiveOld] Failed to create audit log:', auditError);
      }

      return NextResponse.json({
        success: true,
        message: logMessage,
        data: {
          archivedCount: result.count,
          samplePosts: result.posts,
          timestamp: new Date().toISOString(),
          operation: 'archive_old_posts',
          duration: `${duration}ms`,
          settings: {
            olderThanDays,
            setAsExclusivity,
            addArchiveTag
          }
        }
      });
      
    } catch (error) {
      console.error('[ArchiveOld] Archive operation failed:', error);
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Archive operation failed',
          details: error instanceof Error ? error.message : 'Unknown error',
          operation: 'archive_old_posts',
          timestamp: new Date().toISOString(),
          ...(process.env.NODE_ENV === "development" ? serializeError(error) : {})
        },
        { status: 500 }
      );
    }
  });
}