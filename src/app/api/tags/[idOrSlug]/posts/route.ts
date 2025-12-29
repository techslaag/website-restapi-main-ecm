import IPaginateResponse from "@/interfaces/IPaginateResponse";
import IPost, { toIPost } from "@/interfaces/IPost";
import {
  getPaginationMetaData,
  injectFeaturedImages,
} from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import { extractQueryParams, isNumeric, toSafeJSON } from "@/lib/utils/index";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { idOrSlug } }: { params: { idOrSlug: string } },
) {
  // extract query parameters
  const queryParams = extractQueryParams(req);

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);

  // filter to be used for both pagination meta and the data list
  const whereQuery: Prisma.mod180_postsWhereInput = {
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
    termRelationships: {
      some: {
        taxonomy: {
          OR: [
            isNumeric(idOrSlug)
              ? { term_id: BigInt(idOrSlug) }
              : { term: { slug: idOrSlug } },
          ],
          taxonomy: "post_tag",
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
      archived: true,
      archivedAt: true,
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

  const postsWithFeaturedImages = await injectFeaturedImages(
    posts.map((item) => toIPost(item)),
  );

  return Response.json(
    toSafeJSON<IPaginateResponse<IPost>>({
      ...paginationMeta.meta,
      items: postsWithFeaturedImages,
    }),
  );
}
