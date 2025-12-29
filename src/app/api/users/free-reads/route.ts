import { NextResponse } from "next/server";
import authMiddleware from "@/lib/auth/authMiddleware";
import prisma from "@/lib/prisma";
import { hasActiveSubscription } from "@/lib/utils/subscriptionUtils";
import { FreeArticleType } from "@prisma/client";

export const dynamic = "force-dynamic";

// Combined free article limit (premium + ecomembre)
const FREE_ARTICLE_LIMIT = 5;

/**
 * GET - Get user's free article read status
 * Returns the combined count of free articles read (premium + ecomembre)
 */
export async function GET(request: Request) {
  return authMiddleware(request, async (user) => {
    try {
      // Check if user has an active subscription
      const hasSubscription = await hasActiveSubscription(user);

      if (hasSubscription) {
        // User has subscription, unlimited access
        return NextResponse.json({
          hasSubscription: true,
          freeReads: {
            used: 0,
            remaining: Infinity,
            limit: Infinity,
          },
          message: "Accès illimité avec votre abonnement",
        });
      }

      // Get total count of free reads (both premium and ecomembre combined)
      const totalReads = await prisma.freeArticleRead.count({
        where: { userId: user.id },
      });

      // Get the list of article IDs already read
      const readArticles = await prisma.freeArticleRead.findMany({
        where: { userId: user.id },
        select: {
          articleId: true,
          articleType: true,
          readAt: true,
        },
        orderBy: { readAt: "desc" },
      });

      return NextResponse.json({
        hasSubscription: false,
        freeReads: {
          used: totalReads,
          remaining: Math.max(0, FREE_ARTICLE_LIMIT - totalReads),
          limit: FREE_ARTICLE_LIMIT,
        },
        readArticles: readArticles.map((r) => ({
          articleId: r.articleId.toString(),
          articleType: r.articleType,
          readAt: r.readAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching free reads:", error);
      return NextResponse.json(
        { error: "Erreur serveur" },
        { status: 500 }
      );
    }
  });
}

/**
 * POST - Record a free article read
 * Body: { articleId: string, articleType: "premium" | "ecomembre", deviceId?: string }
 */
export async function POST(request: Request) {
  return authMiddleware(request, async (user) => {
    try {
      const body = await request.json();
      const { articleId, articleType, deviceId } = body;

      // Validate input
      if (!articleId) {
        return NextResponse.json(
          { error: "articleId est requis" },
          { status: 400 }
        );
      }

      if (!articleType || !["premium", "ecomembre"].includes(articleType)) {
        return NextResponse.json(
          { error: "articleType doit être 'premium' ou 'ecomembre'" },
          { status: 400 }
        );
      }

      const articleIdBigInt = BigInt(articleId);
      const freeArticleType = articleType as FreeArticleType;

      // Check if user has an active subscription
      const hasSubscription = await hasActiveSubscription(user);

      if (hasSubscription) {
        // User has subscription, no need to track
        return NextResponse.json({
          success: true,
          hasSubscription: true,
          message: "Accès illimité avec votre abonnement",
        });
      }

      // Check if article exists
      const article = await prisma.mod180_posts.findUnique({
        where: { ID: articleIdBigInt },
        select: { ID: true, post_title: true },
      });

      if (!article) {
        return NextResponse.json(
          { error: "Article non trouvé" },
          { status: 404 }
        );
      }

      // Check if user already read this article
      const existingRead = await prisma.freeArticleRead.findUnique({
        where: {
          userId_articleId: {
            userId: user.id,
            articleId: articleIdBigInt,
          },
        },
      });

      if (existingRead) {
        // Already read, return success without counting again
        return NextResponse.json({
          success: true,
          alreadyRead: true,
          message: "Vous avez déjà lu cet article",
        });
      }

      // Check if user has reached the combined limit
      const currentCount = await prisma.freeArticleRead.count({
        where: { userId: user.id },
      });

      if (currentCount >= FREE_ARTICLE_LIMIT) {
        return NextResponse.json(
          {
            error: "Limite atteinte",
            message: `Vous avez atteint la limite de ${FREE_ARTICLE_LIMIT} articles gratuits`,
            limitReached: true,
            used: currentCount,
            limit: FREE_ARTICLE_LIMIT,
          },
          { status: 403 }
        );
      }

      // Record the free read
      const freeRead = await prisma.freeArticleRead.create({
        data: {
          userId: user.id,
          articleId: articleIdBigInt,
          articleType: freeArticleType,
          deviceId: deviceId || null,
        },
      });

      const newCount = currentCount + 1;
      const remaining = Math.max(0, FREE_ARTICLE_LIMIT - newCount);

      return NextResponse.json({
        success: true,
        freeRead: {
          id: freeRead.id,
          articleId: freeRead.articleId.toString(),
          articleType: freeRead.articleType,
          readAt: freeRead.readAt,
        },
        stats: {
          used: newCount,
          remaining: remaining,
          limit: FREE_ARTICLE_LIMIT,
        },
        message: remaining > 0
          ? `Il vous reste ${remaining} article${remaining > 1 ? "s" : ""} gratuit${remaining > 1 ? "s" : ""}`
          : `Vous avez utilisé tous vos articles gratuits`,
      });
    } catch (error) {
      console.error("Error recording free read:", error);

      // Handle unique constraint violation (race condition)
      if ((error as any)?.code === "P2002") {
        return NextResponse.json({
          success: true,
          alreadyRead: true,
          message: "Vous avez déjà lu cet article",
        });
      }

      return NextResponse.json(
        { error: "Erreur serveur" },
        { status: 500 }
      );
    }
  });
}

/**
 * @swagger
 * /api/users/free-reads:
 *   get:
 *     summary: Get user's free article read status
 *     description: Returns the combined count of free articles read (premium + ecomembre). User must be logged in.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Free read status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasSubscription:
 *                   type: boolean
 *                 freeReads:
 *                   type: object
 *                   properties:
 *                     used:
 *                       type: integer
 *                       description: Total articles read (premium + ecomembre)
 *                     remaining:
 *                       type: integer
 *                       description: Remaining free articles
 *                     limit:
 *                       type: integer
 *                       description: Maximum free articles (5)
 *       401:
 *         description: Non autorisé - User must be logged in
 *   post:
 *     summary: Record a free article read
 *     description: Records that the user has read a free premium/ecomembre article. Combined limit of 5 articles.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - articleId
 *               - articleType
 *             properties:
 *               articleId:
 *                 type: string
 *               articleType:
 *                 type: string
 *                 enum: [premium, ecomembre]
 *               deviceId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Free read recorded
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Limit reached (5 articles max)
 *       401:
 *         description: Non autorisé - User must be logged in
 */
