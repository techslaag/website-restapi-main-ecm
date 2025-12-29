import prisma from "@/lib/prisma";
import { isNumeric, toSafeJSON } from "@/lib/utils/index";
import { Prisma } from "@prisma/client";
import IPodcast, { toIPodcast, toUpdateIPodcast } from "@/interfaces/IPodcast";
import IPostMedia from "@/interfaces/IPostMedia";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { idOrSlug } }: { params: { idOrSlug: string } },
) {
  // filter to be used for both pagination meta and the data list
  const whereQuery: Prisma.mod180_postsWhereInput = {
    post_type: "podcast",
    post_status: "publish",
    OR: [
      isNumeric(idOrSlug) ? { ID: BigInt(idOrSlug) } : { post_name: idOrSlug },
    ],
  };

  const podcast = await prisma.mod180_posts.findFirst({
    where: whereQuery,
    select: {
      ID: true,
      post_name: true,
      post_excerpt: true,
      post_title: true,
      post_date: true,
      post_date_gmt: true,
      meta: {
        select: {
          meta_key: true,
          meta_value: true,
        },
      },
      termRelationships: {
        include: {
          taxonomy: {
            include: {
              term: true,
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
    },
  });

  const formattedPodcast = toSafeJSON(podcast);
  const parsedPodcast = toIPodcast(formattedPodcast);
  const media = await prisma.mod180_posts.findUnique({
    where: {
      ID: Number(parsedPodcast.mediaId),
    },
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
  });

  if (media == null) {
    return Response.json(toSafeJSON<IPodcast>(parsedPodcast));
  } else {
    const parsedMedia = {
      id: media.ID.toString(),
      mediaType: media.post_mime_type?.split("/")[0] ?? "file",
      mimeType: media.post_mime_type,
      title: media.post_title,
      altText: media.meta?.find(
        (item) => item.meta_key === "_wp_attachment_image_alt",
      )?.meta_value,
      caption: media.post_excerpt,
      sourceUrl: media.guid,
      mediaPath: media.meta?.find(
        (item) => item.meta_key === "_wp_attached_file",
      )?.meta_value!,
      date: media.post_date,
    } as IPostMedia;

    return Response.json(
      toSafeJSON<IPodcast>(toUpdateIPodcast(parsedPodcast, parsedMedia)),
    );
  }
}
