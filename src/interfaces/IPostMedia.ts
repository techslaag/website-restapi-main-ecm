import { mod180_postmeta, mod180_posts } from "@prisma/client";

export default interface IPostMedia {
  id: string;
  date?: Date | null;
  title?: string;
  caption?: string;
  altText?: string | null;
  mediaType: string;
  mimeType: string;
  mediaDetails?: MediaDetails;
  sourceUrl: string;
  mediaPath: string;
}

export interface MediaDetails {
  width: number;
  height: number;
  file: string;
  filesize: number;
  sizes: Sizes;
  image_meta: ImageMeta;
}

export interface Sizes {
  medium: Medium;
  large: Large;
  thumbnail: Thumbnail;
  medium_large: MediumLarge;
  "jannah-image-small": JannahImageSmall;
  "jannah-image-large": JannahImageLarge;
  "jannah-image-post": JannahImagePost;
  full: Full;
}

export interface Medium {
  file: string;
  width: number;
  height: number;
  filesize: number;
  mime_type: string;
  source_url: string;
}

export interface Large {
  file: string;
  width: number;
  height: number;
  filesize: number;
  mime_type: string;
  source_url: string;
}

export interface Thumbnail {
  file: string;
  width: number;
  height: number;
  filesize: number;
  mime_type: string;
  source_url: string;
}

export interface MediumLarge {
  file: string;
  width: number;
  height: number;
  filesize: number;
  mime_type: string;
  source_url: string;
}

export interface JannahImageSmall {
  file: string;
  width: number;
  height: number;
  filesize: number;
  mime_type: string;
  source_url: string;
}

export interface JannahImageLarge {
  file: string;
  width: number;
  height: number;
  filesize: number;
  mime_type: string;
  source_url: string;
}

export interface JannahImagePost {
  file: string;
  width: number;
  height: number;
  filesize: number;
  mime_type: string;
  source_url: string;
}

export interface Full {
  file: string;
  width: number;
  height: number;
  mime_type: string;
  source_url: string;
}

export interface ImageMeta {
  aperture: string;
  credit: string;
  camera: string;
  caption: string;
  created_timestamp: string;
  copyright: string;
  focal_length: string;
  iso: string;
  shutter_speed: string;
  title: string;
  orientation: string;
  keywords: any[];
}

export interface Self {
  href: string;
}

export interface Collection {
  href: string;
}

export interface About {
  href: string;
}

export interface Author {
  embeddable: boolean;
  href: string;
}

export interface Reply {
  embeddable: boolean;
  href: string;
}

export function toIPostMedia(
  item: Pick<
    mod180_posts,
    | "ID"
    | "post_type"
    | "post_mime_type"
    | "post_title"
    | "post_excerpt"
    | "guid"
    | "post_date"
  > & { meta?: Pick<mod180_postmeta, "meta_key" | "meta_value">[] },
): IPostMedia {
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
    mediaPath: item.meta?.find((item) => item.meta_key === "_wp_attached_file")
      ?.meta_value!,
    date: item.post_date,
  };
}
