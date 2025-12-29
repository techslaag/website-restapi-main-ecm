import { toIDirect } from "@/interfaces/IDirect";
import {
  getPaginationMetaData,
  injectDirectFeaturedImages
} from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const queryParams = extractQueryParams(req);

  if (queryParams.page) {
    if (!Number(queryParams.page)) {
      return Response.json(
        {
          error: "Invalid page number",
        },
        {
          status: 400,
        },
      );
    }
  }

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);
  
  const today = queryParams.today === "true" || queryParams.today === "1";

  // filter to be used for both pagination meta and the data list
  let whereQuery: Prisma.mod180_postsWhereInput = {
    post_type: "directs",
    post_status: "publish",
    meta: {
      some: {
        meta_key: "actif",
        meta_value: "1",
      },
    },
  };

  // Add today filter if requested
  if (today) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    
    whereQuery = {
      ...whereQuery,
      post_date_gmt: {
        gte: startOfToday,
        lte: endOfToday,
      },
    };
  }

  const paginationMeta = await getPaginationMetaData(
    "mod180_posts",
    page,
    limit,
    whereQuery,
  );

  const directs = await prisma.mod180_posts.findMany({
    where: whereQuery,
    orderBy: {
      post_date_gmt: "desc",
    },
    ...paginationMeta.query,
    select: {
      ID: true,
      post_name: true,
      post_title: true,
      post_content: true,
      post_excerpt: true,
      post_status: true,
      post_date: true,
      post_date_gmt: true,
      post_modified: true,
      post_modified_gmt: true,
      author: {
        select: {
          ID: true,
          display_name: true,
          user_nicename: true,
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
      meta: {
        select: {
          meta_key: true,
          meta_value: true,
        },
      },
    },
  });

  if (directs == null) {
    return Response.json(
      {
        error: `Directs not found`,
      },
      {
        status: 404,
      },
    );
  }

  const directsData = directs.map((item) => toIDirect(item));
  
  const directsWithFeaturedImages = await injectDirectFeaturedImages(directsData);

  return Response.json({
    ...paginationMeta.meta,
    items: toSafeJSON(directsWithFeaturedImages),
  });
}