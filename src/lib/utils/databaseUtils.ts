import IPaginateResponse, {
  IPaginateResponseMeta,
} from "@/interfaces/IPaginateResponse";
import IPost, { toUpdatePost } from "@/interfaces/IPost";
import { toIPostMedia } from "@/interfaces/IPostMedia";
import { Prisma } from "@prisma/client";
import prisma from "../prisma";
import { toSafeJSON } from ".";
import IAd, { toUpdateIAd } from "@/interfaces/IAd";
import IDirect, { toUpdateIDirect } from "@/interfaces/IDirect";

export async function getPaginatedResult<
  Model extends keyof Prisma.TypeMap["model"] = keyof Prisma.TypeMap["model"],
  T extends
    Prisma.TypeMap["model"][Model]["payload"]["name"] = Prisma.TypeMap["model"][Model]["payload"]["name"],
>(
  table: T,
  page: number = 1,
  limit: number = 20,
  filter: Omit<
    Prisma.TypeMap["model"][Model]["operations"]["findMany"]["args"],
    "skip" | "take"
  >,
): Promise<
  IPaginateResponse<
    Prisma.TypeMap["model"][Model]["operations"]["findMany"]["result"][0]
  >
> {
  const total = await (prisma[table as any] as any).count({
    where: (filter as any).where,
  });

  const offset = (page - 1) * limit;

  const items = await (prisma[table as any] as any).findMany({
    ...filter,
    skip: offset,
    take: limit,
  });

  const totalPages = Math.ceil(total / limit);

  return {
    items: toSafeJSON(items),
    limit,
    page,
    total,
    totalPages,
  };
}

export async function getPaginationMetaData<
  Model extends keyof Prisma.TypeMap["model"] = keyof Prisma.TypeMap["model"],
  T extends
    Prisma.TypeMap["model"][Model]["payload"]["name"] = Prisma.TypeMap["model"][Model]["payload"]["name"],
>(
  table: T,
  page: number = 1,
  limit: number = 20,
  filter: Prisma.TypeMap["model"][Model]["operations"]["findMany"]["args"]["where"],
): Promise<{
  query: { skip: number; take: number };
  meta: IPaginateResponseMeta;
}> {
  const total = await (prisma[table as any] as any).count({
    where: filter,
  });

  const offset = (page - 1) * limit;

  const totalPages = Math.ceil(total / limit);

  return {
    query: { skip: offset, take: limit } as const,
    meta: { limit, page, total, totalPages } as const,
  };
}

// Check if post have featured image and resolve problem
export async function getPostFeaturedImage(post: IPost): Promise<IPost> {
  let returnedPost: IPost = post;
  const media = await prisma.mod180_posts.findUnique({
    where: {
      ID: Number(post.featuredMediaId),
    },
  });
  if (media) {
    returnedPost = toUpdatePost(post, toIPostMedia(media));
  }
  return returnedPost;
}

export async function injectFeaturedImages(posts: IPost[]) {
  // load featured images
  const featuredImagesIds = posts
    .map((item) => item.featuredMediaId)
    .filter((id) => !!id)
    .map((id) => Number(id));

  // fetch posts
  const featuredImagePosts = await prisma.mod180_posts.findMany({
    where: {
      ID: {
        in: featuredImagesIds,
      },
    },
  });

  return posts.map((post) => {
    //check if media and insert if not
    if (post.featuredMediaId) {
      const featuredImagePost = featuredImagePosts.find(
        (item) => item.ID.toString() === post.featuredMediaId,
      );

      if (featuredImagePost) {
        return toUpdatePost(post, toIPostMedia(featuredImagePost));
      } else {
        return post;
      }
    } else {
      return post;
    }
  });
}

export async function injectBannerImages(ads: IAd[]) {
  // load featured images
  const bannerImagesIds = ads
    .map((item) => item.bannerSourceId)
    .filter((id) => !!id)
    .map((id) => Number(id));

  // fetch posts
  const featuredBannerImages = await prisma.mod180_posts.findMany({
    where: {
      ID: {
        in: bannerImagesIds,
      },
    },
  });

  return ads.map((ad) => {
    //check if media and insert if not
    if (ad.bannerSourceId) {
      const featuredBannerImage = featuredBannerImages.find(
        (item) => item.ID.toString() === ad.bannerSourceId,
      );

      if (featuredBannerImage) {
        return toUpdateIAd(ad, toIPostMedia(featuredBannerImage));
      } else {
        return ad;
      }
    } else {
      return ad;
    }
  });
}

export async function injectDirectFeaturedImages(directs: IDirect[]) {
  // load featured images
  const featuredImagesIds = directs
    .map((item) => item.featuredImageId)
    .filter((id) => !!id)
    .map((id) => Number(id));
  // fetch posts
  const featuredImages = await prisma.mod180_posts.findMany({
    where: {
      ID: {
        in: featuredImagesIds,
      },
    },
  });
  return directs.map((direct) => {
    //check if media and insert if not
    if (direct.featuredImageId) {
      const featuredImage = featuredImages.find(
        (item) => item.ID.toString() === direct.featuredImageId,
      );
      if (featuredImage) {
        return toUpdateIDirect(direct, toIPostMedia(featuredImage));
      } else {
        return direct;
      }
    } else {
      return direct;
    }
  });
}

