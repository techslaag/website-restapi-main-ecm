import { toIPost } from "@/interfaces/IPost";
import { injectFeaturedImages } from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import { toSafeJSON, extractQueryParams } from "@/lib/utils/index";
import { Prisma } from "@prisma/client";
import { getArchiveFilterForUser } from "@/lib/utils/archiveUtils";
import optionalAuthMiddleware from "@/lib/auth/optionalAuthMiddleware";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return optionalAuthMiddleware(req, async (user) => {
    try {
      const queryParams = extractQueryParams(req);
      
      // Get archive filter based on user subscription status
      const archiveFilter = await getArchiveFilterForUser(user || null);
      
      // Use Prisma ORM query to properly include metadata for featured images
      const posts = await prisma.mod180_posts.findMany({
        where: {
          post_type: 'post',
          post_status: 'publish',
          // Apply archive filter condition
          ...(archiveFilter === '1=1' 
            ? {} 
            : { 
                OR: [
                  { archived: { not: true } },
                  { archived: null }
                ]
              }
          ),
          // Post type filter - exclude opinions using meta
          meta: {
            some: {
              meta_key: 'post_type',
              meta_value: { not: 'opinion' }
            }
          },
          // Exclude affairs and classements using NOT EXISTS equivalent
          NOT: {
            termRelationships: {
              some: {
                taxonomy: {
                  taxonomy: { in: ['affair', 'classement'] }
                }
              }
            }
          }
        },
        include: {
          meta: true,
          termRelationships: {
            include: {
              taxonomy: {
                include: {
                  term: true
                }
              }
            }
          },
          children: true,
          author: true
        },
        orderBy: {
          post_date_gmt: 'desc'
        },
        take: 15
      });

      if (!posts || !Array.isArray(posts)) {
        return Response.json([]);
      }

      // Convert Prisma results to IPost format
      const formattedPosts = posts
        .filter(post => post && post.ID) // Filter out null posts or posts without ID
        .map((item) => toIPost(item));

      // Debug: Log post structure before and after featured image injection
      if (formattedPosts.length > 0) {
        const firstPost = formattedPosts[0];
        console.log('Breaking news API: First formatted post:', {
          id: firstPost.id,
          title: firstPost.title?.substring(0, 50) + "...",
          featuredMediaId: firstPost.featuredMediaId,
          hasFeaturedMediaId: !!firstPost.featuredMediaId
        });
      }

      const postsWithFeaturedImages = await injectFeaturedImages(formattedPosts);
      
      // Debug: Log after featured image injection
      if (postsWithFeaturedImages.length > 0) {
        const firstPost = postsWithFeaturedImages[0];
        console.log('Breaking news API: First post after image injection:', {
          id: firstPost.id,
          title: firstPost.title?.substring(0, 50) + "...",
          hasFeaturedMedia: !!firstPost.featuredMedia,
          featuredMediaSourceUrl: firstPost.featuredMedia?.sourceUrl?.substring(0, 100) + "..."
        });
      }

      return Response.json(toSafeJSON(postsWithFeaturedImages));
    } catch (error) {
      console.error('Breaking news API error:', error);
      return Response.json(
        {
          error: 'Failed to fetch breaking news',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  });
}
