import { mod180_postmeta, mod180_posts } from "@prisma/client";
import IPostMedia from "@/interfaces/IPostMedia";
import IPost from "@/interfaces/IPost";

export default interface IAd {
  id: string;
  title: string;
  position: string;
  redirectUrl: string;
  bannerImage?: IPostMedia;
  bannerSourceId?: string;
  expiresAt: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toIAd(
  item: Pick<
    mod180_posts,
    "ID" | "post_date" | "post_date_gmt" | "post_title"
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
    meta?: Pick<mod180_postmeta, "meta_key" | "meta_value">[];
  },
): IAd {
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

  const bannerId = item.meta?.find(
    (m) => m.meta_key === "image_source_url",
  )?.meta_value;

  return {
    id: item.ID.toString(),
    title: item.post_title,
    position:
      item.meta?.find((m) => m.meta_key === "position")?.meta_value || "",
    redirectUrl:
      item.meta?.find((m) => m.meta_key === "redirect_url")?.meta_value || "",
    bannerImage: media.find((m) => m.id === bannerId),
    bannerSourceId:
      item.meta?.find((m) => m.meta_key === "image_source_url")?.meta_value ||
      "",
    expiresAt:
      item.meta?.find((m) => m.meta_key === "expires_at")?.meta_value || "",
    createdAt: item.post_date_gmt!,
    updatedAt: item.post_date_gmt!,
  };
}

export function toUpdateIAd(item: IAd, image: IPostMedia): IAd {
  item.bannerImage = image;
  return {
    ...item,
  };
}
