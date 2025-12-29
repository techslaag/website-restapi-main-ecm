import { NextRequest, NextResponse } from 'next/server';
import { ArchiveService } from '@/lib/services/archiveService';
import authMiddleware from '@/lib/auth/authMiddleware';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /admin/posts/archive/fix-prestige:
 *   post:
 *     summary: Fix archived posts that don't have proper prestige
 *     description: Ensures all archived posts have correct prestige (ecomembre, premium, or gratuit) and appropriate pricing
 *     tags:
 *       - Admin
 *       - Posts
 *       - Archive
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ensureEcomembre:
 *                 type: boolean
 *                 default: true
 *               postPrestige:
 *                 type: string
 *                 enum: [ecomembre]
 *                 default: ecomembre
 *               price:
 *                 type: string
 *                 default: "5"
 *               currency:
 *                 type: string
 *                 default: "EUR"
 *     responses:
 *       200:
 *         description: Prestige fix completed successfully
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
 *                     fixed:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 *   get:
 *     summary: Get count of archived posts with incorrect prestige
 *     description: Returns statistics about archived posts that need prestige fixes
 *     tags:
 *       - Admin
 *       - Posts
 *       - Archive
 *     responses:
 *       200:
 *         description: Prestige statistics retrieved successfully
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
 *                     needsFix:
 *                       type: integer
 *                     total:
 *                       type: integer
 */

// POST /api/admin/posts/archive/fix-prestige - Fix archived posts prestige
export async function POST(req: NextRequest) {
  return authMiddleware(req, async (user) => {
    // Verify that the user is admin
    if (!user.admin) {
      console.log(`[FixPrestige] Non-admin user ${user.id} attempted to fix prestige`);
      return NextResponse.json(
        { 
          success: false,
          error: 'Admin access required for prestige management' 
        },
        { status: 403 }
      );
    }

    try {
      const body = await req.json().catch(() => ({}));
      const { ensureEcomembre = true, postPrestige = "ecomembre", price = "5", currency = "EUR" } = body;

      console.log(`[FixPrestige] Admin ${user.id} fixing archived posts prestige`);

      // Get all archived posts that don't have proper prestige (ecomembre, premium, or gratuit)
      const postsToFix = await prisma.$queryRaw`
        SELECT DISTINCT p.ID, p.post_title
        FROM mod180_posts p
        WHERE p.post_type = 'post'
        AND p.post_status = 'publish'
        AND p.archived = TRUE 
        AND p.archivedAt IS NOT NULL
        AND p.ID NOT IN (
          SELECT post_id 
          FROM mod180_postmeta 
          WHERE meta_key = 'post_prestige' 
          AND meta_value IN ('ecomembre', 'premium', 'gratuit')
        )
        LIMIT 10000
      `;

      if (!Array.isArray(postsToFix) || postsToFix.length === 0) {
        return NextResponse.json({
          success: true,
          message: "All archived posts already have correct prestige (ecomembre, premium, or gratuit)",
          data: {
            fixed: 0,
            total: 0
          }
        });
      }

      console.log(`[FixPrestige] Found ${postsToFix.length} posts that need prestige fixes`);

      // Fix prestige in batches
      const batchSize = 100;
      let totalFixed = 0;

      for (let i = 0; i < postsToFix.length; i += batchSize) {
        const batch = postsToFix.slice(i, i + batchSize);
        const ids = batch.map(post => post.ID);
        
        await prisma.$transaction(async (tx) => {
          // Update existing post_prestige metadata to ecomembre
          const prestigeUpdates = await tx.$executeRaw`
            UPDATE mod180_postmeta 
            SET meta_value = 'ecomembre' 
            WHERE post_id IN (${Prisma.join(ids)}) 
            AND meta_key = 'post_prestige'
          `;

          // Insert post_prestige = ecomembre for posts that don't have this meta
          const prestigeInserts = await tx.$executeRaw`
            INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
            SELECT ID, 'post_prestige', 'ecomembre'
            FROM mod180_posts 
            WHERE ID IN (${Prisma.join(ids)})
            AND ID NOT IN (
              SELECT post_id 
              FROM mod180_postmeta 
              WHERE meta_key = 'post_prestige' 
              AND post_id IN (${Prisma.join(ids)})
            )
          `;

          // Update existing prix metadata to 5
          const priceUpdates = await tx.$executeRaw`
            UPDATE mod180_postmeta 
            SET meta_value = '5' 
            WHERE post_id IN (${Prisma.join(ids)}) 
            AND meta_key = 'prix'
          `;

          // Insert prix = 5 for posts that don't have this meta
          const priceInserts = await tx.$executeRaw`
            INSERT INTO mod180_postmeta (post_id, meta_key, meta_value)
            SELECT ID, 'prix', '5'
            FROM mod180_posts 
            WHERE ID IN (${Prisma.join(ids)})
            AND ID NOT IN (
              SELECT post_id 
              FROM mod180_postmeta 
              WHERE meta_key = 'prix' 
              AND post_id IN (${Prisma.join(ids)})
            )
          `;

          totalFixed += ids.length;
          console.log(`[FixPrestige] Fixed batch: ${ids.length} posts (total: ${totalFixed})`);
        });
      }

      const samplePosts = postsToFix.slice(0, 5).map(post => post.post_title);

      return NextResponse.json({
        success: true,
        message: `Successfully fixed prestige for ${totalFixed} archived posts`,
        data: {
          fixed: totalFixed,
          total: postsToFix.length,
          samplePosts
        }
      });
    } catch (error) {
      console.error('[FixPrestige] Error fixing archived posts prestige:', error);
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to fix archived posts prestige',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  });
}

// GET /api/admin/posts/archive/fix-prestige - Get statistics about posts that need prestige fixes
export async function GET(req: NextRequest) {
  return authMiddleware(req, async (user) => {
    // Verify that the user is admin
    if (!user.admin) {
      console.log(`[FixPrestige] Non-admin user ${user.id} attempted to check prestige stats`);
      return NextResponse.json(
        { 
          success: false,
          error: 'Admin access required for prestige management' 
        },
        { status: 403 }
      );
    }

    try {
      console.log(`[FixPrestige] Admin ${user.id} checking prestige statistics`);

      // Count archived posts that don't have proper prestige (ecomembre, premium, or gratuit)
      const needsFixResult = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT p.ID) as count
        FROM mod180_posts p
        WHERE p.post_type = 'post'
        AND p.post_status = 'publish'
        AND p.archived = TRUE 
        AND p.archivedAt IS NOT NULL
        AND p.ID NOT IN (
          SELECT post_id 
          FROM mod180_postmeta 
          WHERE meta_key = 'post_prestige' 
          AND meta_value IN ('ecomembre', 'premium', 'gratuit')
        )
      `;

      // Count total archived posts
      const totalArchivedResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM mod180_posts 
        WHERE post_type = 'post' 
        AND post_status = 'publish'
        AND archived = TRUE 
        AND archivedAt IS NOT NULL
      `;

      const needsFix = Array.isArray(needsFixResult) && needsFixResult[0] 
        ? Number(needsFixResult[0].count) 
        : 0;
      const total = Array.isArray(totalArchivedResult) && totalArchivedResult[0] 
        ? Number(totalArchivedResult[0].count) 
        : 0;

      return NextResponse.json({
        success: true,
        data: {
          needsFix,
          total,
          percentage: total > 0 ? ((needsFix / total) * 100).toFixed(1) : '0'
        }
      });
    } catch (error) {
      console.error('[FixPrestige] Error checking prestige statistics:', error);
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to check prestige statistics',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  });
}