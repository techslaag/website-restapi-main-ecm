import { NextRequest } from 'next/server';
import { toIPost } from "@/interfaces/IPost";
import {
  getPaginationMetaData,
  injectFeaturedImages,
} from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import {
  extractQueryParams,
  forceNumberOrDefault,
} from "@/lib/utils/index";
import { Prisma } from "@prisma/client";
import optionalAuthMiddleware from "@/lib/auth/optionalAuthMiddleware";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return optionalAuthMiddleware(req, async (user) => {
    try {
      // extract query parameters
      const queryParams = extractQueryParams(req);
      const page = forceNumberOrDefault(queryParams.page, 1),
        limit = forceNumberOrDefault(queryParams.limit, 25);
      
      // Extract filter parameters
      const year = queryParams.year ? parseInt(queryParams.year) : null;
      const month = queryParams.month ? parseInt(queryParams.month) : null;
      const search = queryParams.search || '';
      const category = queryParams.category || '';
      const author = queryParams.author || '';
      const sortBy = queryParams.sortBy || 'archiveDate';
      
      // Build the main where query for archived posts
      const whereQuery: Prisma.mod180_postsWhereInput = {
        post_type: "post",
        post_status: "publish",
        archived: true,
        archivedAt: { not: null },
        // Date filters
        ...(year && month ? {
          post_date_gmt: {
            gte: new Date(`${year}-${month.toString().padStart(2, '0')}-01`),
            lt: new Date(year, month, 1) // First day of next month
          }
        } : year ? {
          post_date_gmt: {
            gte: new Date(`${year}-01-01`),
            lt: new Date(`${year + 1}-01-01`)
          }
        } : {}),
        // Search filter across title, content and excerpt
        ...(search && {
          OR: [
            {
              post_title: {
                contains: search
              }
            },
            {
              post_content: {
                contains: search
              }
            },
            {
              post_excerpt: {
                contains: search
              }
            }
          ]
        }),
        // Category filter
        ...(category && {
          termRelationships: {
            some: {
              taxonomy: {
                taxonomy: 'category',
                term: {
                  name: category
                }
              }
            }
          }
        }),
        // Author filter
        ...(author && {
          author: {
            display_name: author
          }
        })
      };

      // get the pagination meta data (page, limit, total pages)
      const paginationMeta = await getPaginationMetaData(
        "mod180_posts",
        page,
        limit,
        whereQuery,
      );

      // Determine sort order based on sortBy parameter
      let orderBy: any = [{ archivedAt: "desc" }, { post_date_gmt: "desc" }];
      
      switch (sortBy) {
        case 'publishDate':
          orderBy = [{ post_date_gmt: "desc" }];
          break;
        case 'title':
          orderBy = [{ post_title: "asc" }];
          break;
        case 'views':
          // For views sorting, we'll need to use raw SQL or sort after fetching
          // For now, fallback to date sorting
          orderBy = [{ post_date_gmt: "desc" }];
          break;
        case 'archiveDate':
        default:
          orderBy = [{ archivedAt: "desc" }, { post_date_gmt: "desc" }];
          break;
      }

      // load the posts
      const posts = await prisma.mod180_posts.findMany({
        where: whereQuery,
        ...paginationMeta.query,
        orderBy,
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
      });

      if (!posts || !Array.isArray(posts)) {
        return Response.json({
          page: page,
          limit: limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
          items: []
        });
      }

      // Convert Prisma results to IPost format
      const formattedPosts = posts
        .filter(post => post && post.ID) // Filter out null posts or posts without ID
        .map((item) => toIPost(item));

      // Inject featured images using the efficient batch method
      const postsWithFeaturedImages = await injectFeaturedImages(formattedPosts);

      return Response.json({
        ...paginationMeta.meta,
        items: postsWithFeaturedImages,
      });
    } catch (error) {
      console.error('Public archive API error:', error);
      return Response.json(
        {
          items: [],
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        },
        { status: 500 }
      );
    }
  });
}