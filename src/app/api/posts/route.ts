import { toIPost } from "@/interfaces/IPost";
import {
  getPaginationMetaData,
  injectFeaturedImages,
} from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { Prisma } from "@prisma/client";
import { getArchiveFilterForUser } from "@/lib/utils/archiveUtils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const queryParams = extractQueryParams(req);

    const page = Number(queryParams.page ?? 1),
      limit = Number(queryParams.limit ?? 25);
    const skip = (page - 1) * limit;

    // Check if user is authenticated (get user from request context if available)
    const user = (req as any).user || null;
    
    // Get archive filter based on user subscription status
    const archiveFilter = await getArchiveFilterForUser(user);
    
    // Get total count with archive filtering
    const totalResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM mod180_posts p
      WHERE p.post_type = 'post' 
        AND p.post_status = 'publish'
        AND ${Prisma.raw(archiveFilter)}
        AND EXISTS (
          SELECT 1 FROM mod180_postmeta pm 
          WHERE pm.post_id = p.ID 
            AND pm.meta_key = 'post_type' 
            AND pm.meta_value != 'opinion'
        )
    `;

    const totalCount = Array.isArray(totalResult) && totalResult[0] 
      ? Number(totalResult[0].count) : 0;
    const totalPages = Math.ceil(totalCount / limit);

    // Get posts with archive filtering
    const posts = await prisma.$queryRaw`
      SELECT 
        p.ID, 
        p.post_name, 
        p.post_status, 
        p.post_excerpt, 
        p.post_title, 
        p.post_date, 
        p.post_date_gmt, 
        p.post_modified, 
        p.post_modified_gmt
      FROM mod180_posts p
      WHERE p.post_type = 'post' 
        AND p.post_status = 'publish'
        AND ${Prisma.raw(archiveFilter)}
        AND EXISTS (
          SELECT 1 FROM mod180_postmeta pm 
          WHERE pm.post_id = p.ID 
            AND pm.meta_key = 'post_type' 
            AND pm.meta_value != 'opinion'
        )
      ORDER BY p.post_date_gmt DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    if (!posts || !Array.isArray(posts)) {
      return Response.json({
        page,
        limit,
        totalPages: 0,
        totalCount: 0,
        hasNext: false,
        hasPrev: false,
        items: []
      });
    }

    // Convert raw query results to IPost format
    const formattedPosts = posts.map(post => ({
      ID: post.ID,
      post_name: post.post_name,
      post_status: post.post_status,
      post_excerpt: post.post_excerpt || '',
      post_title: post.post_title,
      post_date: post.post_date,
      post_date_gmt: post.post_date_gmt,
      post_modified: post.post_modified,
      post_modified_gmt: post.post_modified_gmt,
      archivedAt: null,
      archived: false,
      termRelationships: [],
      children: [],
      meta: [],
      author: {
        ID: BigInt(0),
        user_nicename: '',
        display_name: 'Unknown'
      }
    }));

    const postsWithFeaturedImages = await injectFeaturedImages(
      formattedPosts.map((item) => toIPost(item)),
    );

    return Response.json({
      page,
      limit,
      totalPages,
      totalCount,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      items: toSafeJSON(postsWithFeaturedImages),
    });
  } catch (error) {
    console.error('Posts API error:', error);
    return Response.json(
      {
        error: 'Failed to fetch posts',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
