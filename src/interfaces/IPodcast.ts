import IPostMedia from "@/interfaces/IPostMedia";
import {
  mod180_postmeta,
  mod180_posts,
  mod180_term_taxonomy,
  mod180_terms,
} from "@prisma/client";
import IPostTag, { toIPostTag } from "@/interfaces/IPostTag";

interface Channels {
  youtube: string;
  apple: string;
  spotify: string;
  deezer: string;
}

export default interface IPodcast {
  id: string;
  title: string;
  coverMedia?: IPostMedia;
  mediaId: string;
  media?: IPostMedia;
  description: string;
  createdAt: Date;
  createdAtGmt: Date;
  series: IPostTag[];
  slug: string;
  channels: Channels;
}

export function toIPodcast(
  item: Pick<
    mod180_posts,
    | "ID"
    | "post_title"
    | "post_name"
    | "post_date"
    | "post_date_gmt"
    | "post_excerpt"
  > & {
    children?: (Pick<
      mod180_posts,
      | "ID"
      | "post_type"
      | "post_mime_type"
      | "post_title"
      | "post_excerpt"
      | "guid"
      | "post_date"
    > & { meta?: Pick<mod180_postmeta, "meta_key" | "meta_value">[] })[];
    termRelationships?: {
      taxonomy: Pick<
        mod180_term_taxonomy,
        "count" | "description" | "taxonomy"
      > & {
        term: Pick<mod180_terms, "name" | "slug" | "term_id">;
      };
    }[];
    meta?: Pick<mod180_postmeta, "meta_key" | "meta_value">[];
  },
): IPodcast {
  const media =
    item.children
      ?.filter((item) => item.post_type === "attachment")
      .map<IPostMedia>((item) => {
        return {
          id: item.ID.toString(),
          mediaType: item.post_mime_type?.split("/")[0] ?? "file",
          mimeType: item.post_mime_type,
          title: item.post_title,
          altText: item.meta?.find(
            (item) => item.meta_key === "_wp_attachment_image_alt",
          )?.meta_value,
          caption: item.post_excerpt,
          sourceUrl: item.guid,
          mediaPath: item.meta?.find(
            (item) => item.meta_key === "_wp_attached_file",
          )?.meta_value!,
          date: item.post_date,
        };
      }) ?? [];

  return {
    id: item.ID.toString(),
    title: item.post_title,
    coverMedia: media[0],
    mediaId:
      item.meta?.find((m) => m.meta_key === "media_url")?.meta_value || "",
    description: item.post_excerpt,
    createdAt: item.post_date_gmt! || item.post_date!,
    createdAtGmt: item.post_date_gmt!,
    slug: item.post_name,
    series: (
      item.termRelationships?.filter(
        (item) => item.taxonomy?.taxonomy === "serie",
      ) ?? []
    ).map<IPostTag>((item) => {
      return toIPostTag(item.taxonomy);
    }),
    channels: {
      youtube:
        item.meta?.find((m) => m.meta_key === "youtube")?.meta_value || "",
      apple: item.meta?.find((m) => m.meta_key === "apple")?.meta_value || "",
      spotify:
        item.meta?.find((m) => m.meta_key === "spotify")?.meta_value || "",
      deezer: item.meta?.find((m) => m.meta_key === "deezer")?.meta_value || "",
    },
  };
}

export function toUpdateIPodcast(item: IPodcast, media: IPostMedia): IPodcast {
  item.media = media;
  return {
    ...item,
  };
}
