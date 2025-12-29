import { toIPostCategory } from "@/interfaces/IPostCategory";
import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const queryParams = extractQueryParams(req);

  const slug = String(params.slug).toLowerCase();

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

  // posts filter
  const wherePostsInput: Prisma.mod180_postsWhereInput = {
    OR: [
      { post_excerpt: { contains: slug } },
      { post_title: { contains: slug } },
      {
        termRelationships: {
          some: {
            taxonomy: {
              term: {
                slug: slug,
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

  // load categories
  const categories = await prisma.mod180_term_taxonomy.findMany({
    distinct: "term_taxonomy_id",
    where: {
      taxonomy: "category",
      relationships: {
        some: {
          post: wherePostsInput,
        },
      },
    },
    include: {
      term: true,
      _count: {
        select: {
          relationships: {
            where: {
              post: wherePostsInput,
            },
          },
        },
      },
    },
  });

  return Response.json(toSafeJSON(categories.map(toIPostCategory)));
}
