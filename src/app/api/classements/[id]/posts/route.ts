import IPost, { toIPost } from "@/interfaces/IPost";
import IPaginateResponse from "@/interfaces/IPaginateResponse";
import { getPostFeaturedImage } from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import {
  extractQueryParams,
  forceNumberOrDefault,
  isNumeric,
  toSafeJSON,
} from "@/lib/utils/index";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: idOrSlug } }: { params: { id: string } },
) {
  // extract query parameters
  const queryParams = extractQueryParams(req);

  // get the classement
  const classement = await prisma.mod180_term_taxonomy.findFirst({
    where: {
      OR: [
        isNumeric(idOrSlug)
          ? { term_id: BigInt(idOrSlug) }
          : { term: { slug: idOrSlug } },
      ],
      taxonomy: "classement",
    },
    select: {
      term_taxonomy_id: true,
      term: {
        select: {
          term_id: true,
        },
      },
    },
  });

  if (!classement) {
    return Response.json({ message: "Classement not found." }, { status: 404 });
  }

  const classementTermTaxonomyId = Number(classement.term_taxonomy_id);
  const page = forceNumberOrDefault(queryParams.page, 1),
    limit = forceNumberOrDefault(queryParams.limit, 25);

  // Get total count for pagination
  const totalCountResult = await prisma.$queryRaw<{count: bigint}[]>`
    SELECT COUNT(DISTINCT p.ID) as count
    FROM mod180_posts p
    INNER JOIN mod180_term_relationships tr ON p.ID = tr.object_id
    WHERE tr.term_taxonomy_id = ${classementTermTaxonomyId}
      AND p.post_type = 'post' 
      AND p.post_status = 'publish'
  `;
  
  const total = Number(totalCountResult[0]?.count || 0);
  const totalPages = Math.ceil(total / limit);

  // Get all posts in this classement with position sorted at database level
  const postsRaw = await prisma.$queryRaw<{ID: number}[]>`
    SELECT DISTINCT p.ID
    FROM mod180_posts p
    INNER JOIN mod180_term_relationships tr ON p.ID = tr.object_id
    LEFT JOIN mod180_postmeta pm_pos ON p.ID = pm_pos.post_id 
      AND pm_pos.meta_key = 'c_position'
    WHERE tr.term_taxonomy_id = ${classementTermTaxonomyId}
      AND p.post_type = 'post' 
      AND p.post_status = 'publish'
    ORDER BY 
      CASE 
        WHEN pm_pos.meta_value IS NULL THEN 0
        WHEN pm_pos.meta_value = '' THEN 0
        ELSE CAST(pm_pos.meta_value AS SIGNED)
      END DESC, 
      p.post_date_gmt DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `;

  const postIdsFromQuery = postsRaw.map(row => BigInt(row.ID));
  
  if (postIdsFromQuery.length === 0) {
    return Response.json({
      page,
      limit,
      total,
      totalPages,
      items: [],
    });
  }

  const posts = await prisma.mod180_posts.findMany({
    where: {
      ID: { in: postIdsFromQuery },
    },
    select: {
      ID: true,
      post_name: true,
      post_status: true,
      post_excerpt: true,
      post_title: true,
      post_date: true,
      post_date_gmt: true,
      post_modified: true,
      post_modified_gmt: true,
      meta: {
        select: {
          meta_key: true,
          meta_value: true,
        },
      },
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
      author: {
        select: {
          ID: true,
          display_name: true,
          user_nicename: true,
        },
      },
    },
  });


  const formattedResponse = toSafeJSON(posts);
  let parsedPosts = formattedResponse.map((post: any) => toIPost(post));

  parsedPosts = await Promise.all(
    parsedPosts.map(async (post: IPost) => {
      let parsedPost = post;
      if (post.featuredMediaId) {
        parsedPost = await getPostFeaturedImage(post);
      }
      return parsedPost;
    }),
  );

  // Maintain the order from SQL query
  const orderedPosts = postIdsFromQuery.map(id => 
    parsedPosts.find((post: IPost) => BigInt(post.id) === id)
  ).filter(Boolean) as IPost[];

  return Response.json(
    toSafeJSON<IPaginateResponse<IPost>>({
      page,
      limit,
      total,
      totalPages,
      items: orderedPosts,
    }),
  );
}