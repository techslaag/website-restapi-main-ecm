import { toIPost } from "@/interfaces/IPost";
import {
  getPaginationMetaData,
  getPostFeaturedImage,
} from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import {
  extractQueryParams,
  forceNumberOrDefault,
  isNumeric,
  toSafeJSON
} from "@/lib/utils/index";
import { Prisma } from "@prisma/client";
import { hasActiveSubscription } from "@/lib/utils/subscriptionUtils";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: idOrSlug } }: { params: { id: string } },
) {
  try {
    // extract query parameters
    const queryParams = extractQueryParams(req);

    const page = forceNumberOrDefault(queryParams.page, 1),
      limit = forceNumberOrDefault(queryParams.limit, 25);

  // Check if user is authenticated and has subscription
  const user = (req as any).user || null;
  const userHasSubscription = user ? await hasActiveSubscription(user) : false;

  // filter to be used for both pagination meta and the data list
  const whereQuery: Prisma.mod180_postsWhereInput = {
    post_type: "post",
    post_status: "publish",
    // Archive filtering: non-subscribers should not see archived posts
    ...(userHasSubscription ? {} : { archived: { not: true } }),
    meta: {
      some: {
        meta_key: "post_type",
        meta_value: {
          not: "opinion",
        },
      },
    },
    termRelationships: {
      some: {
        taxonomy: {
          OR: [
            isNumeric(idOrSlug)
              ? { term_id: BigInt(idOrSlug) }
              : { term: { slug: idOrSlug } },
          ],
          taxonomy: "category",
        },
      },
    },
  };

  // get the pagination meta data (page, limit, total pages)
  const paginationMeta = await getPaginationMetaData(
    "mod180_posts",
    page,
    limit,
    whereQuery,
  );

  // load the post
  const posts = await prisma.mod180_posts.findMany({
    where: whereQuery,
    ...paginationMeta.query,

    orderBy: {
      post_date_gmt: "desc",
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

  let parsedPosts = await Promise.all(
    posts.map(async (post) => {
      //check if media and insert if not
      let parsedPost = toIPost(post);
      if (parsedPost.featuredMediaId) {
        parsedPost = await getPostFeaturedImage(parsedPost);
      }
      return parsedPost;
    }),
  );

    return Response.json(toSafeJSON({
      ...paginationMeta.meta,
      items: parsedPosts,
    }));
  } catch (error) {
    console.error('Category posts API error:', error);
    return Response.json(
      {
        error: 'Failed to fetch category posts',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
