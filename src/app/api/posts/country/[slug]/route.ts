import { toIPost } from "@/interfaces/IPost";
import {
  getPaginationMetaData,
  getPostFeaturedImage,
} from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import { extractQueryParams } from "@/lib/utils/index";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const queryParams: {
    page?: string;
    limit?: string;
    start_date?: string;
    end_date?: string;
    categoryId?: string;
  } = extractQueryParams(req);
  const slug = String(decodeURIComponent(params.slug)).toLowerCase();

  if (queryParams.start_date || queryParams.end_date) {
    try {
      if (queryParams.start_date) {
        new Date(queryParams.start_date).toISOString();
      }
      if (queryParams.end_date) {
        new Date(queryParams.end_date).toISOString();
      }
    } catch (e) {
      return Response.json(
        {
          error: "Invalid date format",
        },
        {
          status: 400,
        },
      );
    }
  }

  // where input
  const whereInput: Prisma.mod180_postsWhereInput = {
    OR: [
      { post_excerpt: { contains: slug } },
      { post_title: { contains: slug } },
      {
        termRelationships: {
          some: {
            taxonomy: {
              term: {
                slug,
              },
            },
          },
        },
      },
    ],
    AND: [
      {
        post_date_gmt: {
          gte: queryParams.start_date
            ? new Date(queryParams.start_date).toISOString()
            : new Date(1970, 0, 1).toISOString(),
        },
      },
      {
        post_date_gmt: {
          lte: queryParams.end_date
            ? new Date(queryParams.end_date).toISOString()
            : new Date().toISOString(),
        },
      },
    ],
    post_type: "post",
    post_status: "publish",
    meta: {
      some: {
        meta_key: "post_type",
        meta_value: {
          not: "opinion",
        },
      },
    },
  };

  // category id exists in the query params
  if (queryParams.categoryId) {
    whereInput["termRelationships"] = {
      some: {
        taxonomy: {
          term: {
            term_id: BigInt(queryParams.categoryId),
          },
        },
      },
    };
  }

  // pagination meta
  const paginationMeta = await getPaginationMetaData(
    "mod180_posts",
    Number(queryParams.page ?? 1),
    Number(queryParams.limit ?? 25),
    whereInput,
  );

  const posts = await prisma.mod180_posts.findMany({
    ...paginationMeta.query,
    where: whereInput,
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
      author: {
        select: {
          ID: true,
          display_name: true,
          user_nicename: true,
        },
      },
    },
  });

  if (posts == null) {
    return Response.json(
      {
        error: `Posts of Country ${slug} not found`,
      },
      {
        status: 404,
      },
    );
  }

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

  // const formattedResponse = toSafeJSON<IPaginateResponse<IPost>>({
  //   ...paginationMeta.meta,
  //   items: posts.map(toIPost),
  // });

  return Response.json({
    ...paginationMeta.meta,
    items: parsedPosts,
  });
}
