import { NextRequest, NextResponse } from 'next/server';
import { ArchiveService } from '@/lib/services/archiveService';
import authMiddleware from '@/lib/auth/authMiddleware';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /admin/posts/archive/update-prestige:
 *   post:
 *     summary: Update prestige for a specific archived post
 *     description: Sets the prestige level for an individual archived post with appropriate pricing
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
 *               - postId
 *               - prestige
 *             properties:
 *               postId:
 *                 type: string
 *                 description: The ID of the post to update
 *               prestige:
 *                 type: string
 *                 enum: [premium, free, ecomembre]
 *                 description: The prestige level to set for the post
 *               price:
 *                 type: string
 *                 description: Custom price (optional, defaults based on prestige)
 *               currency:
 *                 type: string
 *                 default: EUR
 *     responses:
 *       200:
 *         description: Post prestige updated successfully
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
 *                     postId:
 *                       type: string
 *                     prestige:
 *                       type: string
 *                     price:
 *                       type: string
 *                     currency:
 *                       type: string
 *                     post_title:
 *                       type: string
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Post not found or not archived
 *       500:
 *         description: Server error
 */

// POST /api/admin/posts/archive/update-prestige - Update prestige for a specific archived post
export async function POST(req: NextRequest) {
  return authMiddleware(req, async (user) => {
    // Verify that the user is admin
    if (!user.admin) {
      console.log(`[UpdatePrestige] Non-admin user ${user.id} attempted prestige update`);
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
      const { postId, prestige, price, currency = "EUR" } = body;
      
      if (!postId) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Post ID is required" 
          },
          { status: 400 }
        );
      }
      
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

      console.log(`[UpdatePrestige] Admin ${user.id} updating post ${postId} to ${prestige} with price ${finalPrice}`);

      // First, verify the post exists and is archived
      const postCheck = await prisma.$queryRaw`
        SELECT ID, post_title, post_status, archived, archivedAt
        FROM mod180_posts 
        WHERE ID = ${Number(postId)}
        AND post_type = 'post'
      `;

      if (!Array.isArray(postCheck) || postCheck.length === 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Post not found" 
          },
          { status: 404 }
        );
      }

      const post = postCheck[0];
      
      if (post.post_status !== 'publish') {
        return NextResponse.json(
          { 
            success: false, 
            error: "Post must be published to update prestige" 
          },
          { status: 400 }
        );
      }

      if (!post.archived || !post.archivedAt) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Post must be archived to update prestige" 
          },
          { status: 400 }
        );
      }

      // Update prestige in a transaction
      await prisma.$transaction(async (tx) => {
        // Update existing post_prestige metadata
        const prestigeUpdate = await tx.$executeRaw`
          UPDATE mod180_postmeta 
          SET meta_value = ${prestige}
          WHERE post_id = ${Number(postId)}
          AND meta_key = 'post_prestige'
        `;

        // If no existing meta was updated, insert new one
        if (Number(prestigeUpdate) === 0) {
          await tx.$executeRaw`
            INSERT INTO mod180_postmeta (post_id, meta_key, meta_value) 
            VALUES (${Number(postId)}, 'post_prestige', ${prestige})
          `;
        }

        // Update existing prix metadata
        const priceUpdate = await tx.$executeRaw`
          UPDATE mod180_postmeta 
          SET meta_value = ${finalPrice}
          WHERE post_id = ${Number(postId)}
          AND meta_key = 'prix'
        `;

        // If no existing prix meta was updated, insert new one
        if (Number(priceUpdate) === 0) {
          await tx.$executeRaw`
            INSERT INTO mod180_postmeta (post_id, meta_key, meta_value) 
            VALUES (${Number(postId)}, 'prix', ${finalPrice})
          `;
        }

        console.log(`[UpdatePrestige] Updated post ${postId}: prestige=${prestige}, price=${finalPrice}`);
      });

      return NextResponse.json({
        success: true,
        message: `Successfully updated post prestige to ${prestige} with price ${finalPrice} ${currency}`,
        data: {
          postId: postId.toString(),
          prestige,
          price: finalPrice,
          currency,
          post_title: post.post_title
        }
      });
    } catch (error) {
      console.error('[UpdatePrestige] Error updating post prestige:', error);
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to update post prestige',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  });
}