import { toIAd } from "@/interfaces/IAd";
import {
  getPaginationMetaData,
  injectBannerImages
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

  const whereQuery: Prisma.mod180_postsWhereInput = {
    post_type: "advertising",
    post_status: "publish",
  };

  const paginationMeta = await getPaginationMetaData(
    "mod180_posts",
    page,
    limit,
    whereQuery,
  );

  const advertisings = await prisma.mod180_posts.findMany({
    where: {
      post_type: "advertising",
      post_status: "publish",
    },
    orderBy: {
      post_date_gmt: "desc",
    },
    ...paginationMeta.query,
    select: {
      ID: true,
      post_name: true,
      post_title: true,
      post_date: true,
      post_date_gmt: true,
      post_modified: true,
      post_modified_gmt: true,
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

  if (advertisings == null) {
    return Response.json(
      {
        error: `Ads not found`,
      },
      {
        status: 404,
      },
    );
  }

  const bannerWithImages = await injectBannerImages(
    advertisings.map((item) => toIAd(item)),
  );

  // Filter out expired ads
  const currentDate = new Date();
  const activeAds = bannerWithImages.filter((ad) => {
    // If no expiration date is set, consider it active
    if (!ad.expiresAt || ad.expiresAt === "") {
      return true;
    }
    
    // Check if the ad has not expired
    const expirationDate = new Date(ad.expiresAt);
    return expirationDate > currentDate;
  });

  // Update pagination meta to reflect filtered results
  const filteredMeta = {
    ...paginationMeta.meta,
    total: activeAds.length,
    totalPages: Math.ceil(activeAds.length / limit),
    items: toSafeJSON(activeAds.slice((page - 1) * limit, page * limit)),
  };

  return Response.json(filteredMeta);

  // return Response.json(
  //   toSafeJSON<IPaginateResponse<IAd>>({
  //     ...paginationMeta.meta,
  //     items: advertisings.map<IAd>((item) => {
  //       return toIAd(item);
  //     }),
  //   }),
  // );
}
