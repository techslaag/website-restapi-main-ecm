import { NextRequest, NextResponse } from 'next/server';
import { ArchiveService } from '@/lib/services/archiveService';
import authMiddleware from '@/lib/auth/authMiddleware';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /admin/posts/archive/bulk-prestige:
 *   post:
 *     summary: Update prestige for all archived posts in bulk
 *     description: Sets the prestige level for all archived posts with appropriate pricing
 *     tags:
 *       - Admin
 *       - Posts
 *       - Archive
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prestige
 *             properties:
 *               prestige:
 *                 type: string
 *                 enum: [premium, free, ecomembre]
 *                 description: The prestige level to set for all archived posts
 *               price:
 *                 type: string
 *                 description: Custom price (optional, defaults based on prestige)
 *               currency:
 *                 type: string
 *                 default: EUR
 *               applyToAll:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Bulk prestige update completed successfully
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
 *                     updated:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     prestige:
 *                       type: string
 *                     price:
 *                       type: string
 *       400:
 *         description: Invalid prestige value
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */

// POST /api/admin/posts/archive/bulk-prestige - Update prestige for all archived posts
export async function POST(req: NextRequest) {
  return authMiddleware(req, async (user) => {
    // Verify that the user is admin
    if (!user.admin) {
      console.log(`[BulkPrestige] Non-admin user ${user.id} attempted bulk prestige update`);
      return NextResponse.json(
        { 
          success: false,
          error: 'Admin access required for prestige management' 
        },
        { status: 403 }
      );
    }

    try {
      const body = await req.json();
      const { prestige, price, currency = "EUR", applyToAll = true } = body;
      
      if (!prestige || !["premium", "free", "ecomembre"].includes(prestige)) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Invalid prestige value. Must be one of: premium, free, ecomembre" 
          },
          { status: 400 }
        );
      }

      // Set default prices based on prestige if not provided
      let finalPrice = price;
      if (!finalPrice) {
        switch (prestige) {
          case "ecomembre":
            finalPrice = "5";
            break;
          case "premium":
            finalPrice = "1";
            break;
          case "free":
          default:
            finalPrice = "0";
            break;
        }
      }

      console.log(`[BulkPrestige] Admin ${user.id} updating all archived posts to ${prestige} with price ${finalPrice}`);

      // Get all archived posts
      const archivedPosts = await prisma.$queryRaw`
        SELECT ID, post_title
        FROM mod180_posts 
        WHERE post_type = 'post'
        AND post_status = 'publish'
        AND archived = TRUE 
        AND archivedAt IS NOT NULL
        LIMIT 50000
      `;

      if (!Array.isArray(archivedPosts) || archivedPosts.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No archived posts found to update",
          data: {
            updated: 0,
            total: 0,
            prestige,
            price: finalPrice
          }
        });
      }

      console.log(`[BulkPrestige] Found ${archivedPosts.length} archived posts to update`);

      // Update prestige in batches
      const batchSize = 100;
      let totalUpdated = 0;

      for (let i = 0; i < archivedPosts.length; i += batchSize) {
        const batch = archivedPosts.slice(i, i + batchSize);
        const ids = batch.map(post => post.ID);
        
        await prisma.$transaction(async (tx) => {
          // Update existing post_prestige metadata
          const prestigeUpdates = await tx.$executeRaw`
            UPDATE mod180_postmeta 
            SET meta_value = ${prestige}
            WHERE post_id IN (${Prisma.join(ids)}) 
            AND meta_key = 'post_prestige'
          `;

          // Insert post_prestige for posts that don't have this meta
          const prestigeInserts = await tx.$executeRaw`
            INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
            SELECT ID, 'post_prestige', ${prestige}
            FROM mod180_posts 
            WHERE ID IN (${Prisma.join(ids)})
            AND ID NOT IN (
              SELECT post_id 
              FROM mod180_postmeta 
              WHERE meta_key = 'post_prestige' 
              AND post_id IN (${Prisma.join(ids)})
            )
          `;

          // Update existing prix metadata
          const priceUpdates = await tx.$executeRaw`
            UPDATE mod180_postmeta 
            SET meta_value = ${finalPrice}
            WHERE post_id IN (${Prisma.join(ids)}) 
            AND meta_key = 'prix'
          `;

          // Insert prix for posts that don't have this meta
          const priceInserts = await tx.$executeRaw`
            INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
            SELECT ID, 'prix', ${finalPrice}
            FROM mod180_posts 
            WHERE ID IN (${Prisma.join(ids)})
            AND ID NOT IN (
              SELECT post_id 
              FROM mod180_postmeta 
              WHERE meta_key = 'prix' 
              AND post_id IN (${Prisma.join(ids)})
            )
          `;

          totalUpdated += ids.length;
          console.log(`[BulkPrestige] Updated batch: ${ids.length} posts (total: ${totalUpdated})`);
        }, {
          timeout: 60000 // 60 seconds timeout for large batches
        });
      }

      const samplePosts = archivedPosts.slice(0, 5).map(post => post.post_title);

      return NextResponse.json({
        success: true,
        message: `Successfully updated ${totalUpdated} archived posts to ${prestige} with price ${finalPrice} ${currency}`,
        data: {
          updated: totalUpdated,
          total: archivedPosts.length,
          prestige,
          price: finalPrice,
          currency,
          samplePosts
        }
      });
    } catch (error) {
      console.error('[BulkPrestige] Error updating bulk archive prestige:', error);
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to update bulk archive prestige',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  });
}