import { toIPost } from "@/interfaces/IPost";
import authMiddleware from "@/lib/auth/authMiddleware";
import { canAccessPost } from "@/lib/utils/postUtils";
import prisma from "@/lib/prisma";
import { generateMobileAppPromotionMessage } from "@/lib/utils/mobileAppPromotionUtils";

// Define the enum locally since Prisma import is causing issues
enum FreeArticleType {
  premium = "premium",
  ecomembre = "ecomembre"
}

export const dynamic = "force-dynamic";

// Combined free article limit (premium + ecomembre)
const FREE_ARTICLE_LIMIT = 5;

export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  return authMiddleware(req, async (user) => {
    // load the post
    const post = await prisma.mod180_posts.findFirst({
      where: {
        OR: [
          { post_name: { equals: String(params.slug) } },
          {
            ID: {
              equals: isNaN(Number(params.slug)) ? -1 : Number(params.slug),
            },
          },
        ],
      },
      select: {
        ID: true,
        post_name: true,
        post_status: true,
        post_excerpt: true,
        post_title: true,
        post_content: true,
        post_date: true,
        post_date_gmt: true,
        post_modified: true,
        post_modified_gmt: true,
        archivedAt: true,
        archived: true,
        termRelationships: {
          select: {
            taxonomy: {
              select: {
                taxonomy: true,
                count: true,
                description: true,
                term: {
                  select: {
                    term_id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
        children: {
          select: {
            ID: true,
            guid: true,
            post_type: true,
            post_excerpt: true,
            post_mime_type: true,
            post_title: true,
            post_date: true,
            meta: {
              select: {
                meta_key: true,
                meta_value: true,
              },
            },
          },
        },
        meta: true,
        author: {
          select: {
            ID: true,
            display_name: true,
            user_nicename: true,
          },
        },
      },
    });

    if (!post) {
      return Response.json(
        {
          error: "Post not found",
        },
        {
          status: 404,
        },
      );
    } else {
      const parsedPost = toIPost(post);

      /**
       * Subscription
       * -------------------------------
       * Delete the post content if the user doesn't have access to it
       */
      const canAccess = await canAccessPost(parsedPost, user);

      // the given user cannot read the post via subscription/purchase
      if (canAccess) {
        return Response.json({
          content: parsedPost.content,
        });
      }

      // Check if user can access via free reads (for premium/ecomembre articles)
      const postPrestige = parsedPost.postPrestige;
      if (postPrestige === "premium" || postPrestige === "ecomembre") {
        const articleIdBigInt = BigInt(parsedPost.id);

        // Check if user already read this article (doesn't count against limit)
        const existingRead = await prisma.freeArticleRead.findUnique({
          where: {
            userId_articleId: {
              userId: user.id,
              articleId: articleIdBigInt,
            },
          },
        });

        if (existingRead) {
          // Already read this article, grant access
          return Response.json({
            content: parsedPost.content,
            freeReadInfo: {
              alreadyRead: true,
              message: "Vous avez déjà lu cet article gratuitement",
            },
          });
        }

        // Check if user has free reads remaining
        const currentCount = await prisma.freeArticleRead.count({
          where: { userId: user.id },
        });

        if (currentCount < FREE_ARTICLE_LIMIT) {
          // User can use a free read - record it and grant access
          const freeArticleType = postPrestige as FreeArticleType;

          await prisma.freeArticleRead.create({
            data: {
              userId: user.id,
              articleId: articleIdBigInt,
              articleType: freeArticleType,
            },
          });

          const newCount = currentCount + 1;
          const remaining = FREE_ARTICLE_LIMIT - newCount;

          return Response.json({
            content: parsedPost.content,
            freeReadInfo: {
              used: newCount,
              remaining: remaining,
              limit: FREE_ARTICLE_LIMIT,
              message: remaining > 0
                ? `Il vous reste ${remaining} article${remaining > 1 ? "s" : ""} gratuit${remaining > 1 ? "s" : ""}`
                : "Vous avez utilisé tous vos articles gratuits",
            },
          });
        }
      }

      // No access - return mobile app promotion
      const mobileAppPromotion = generateMobileAppPromotionMessage(parsedPost);

      return Response.json({
        content: null,
        mobileAppPromotion,
      });
    }
  });
}
