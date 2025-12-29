import {
  mod180_postmeta,
  mod180_posts,
  mod180_term_taxonomy,
  mod180_terms,
  mod180_users,
} from "@prisma/client";
import IPostAuthor, { toIPostAuthor } from "./IPostAuthor";
import IPostCategory, { toIPostCategory } from "./IPostCategory";
import IPostMedia from "./IPostMedia";
import IPostTag, { toIPostTag } from "./IPostTag";
import { toSafeJSON } from "@/lib/utils/index";
import IPostPersonnality from "@/interfaces/IPostPersonnality";

export default interface IOpinion {
  id: string;
  date: Date;
  dateGmt: Date;
  modified: Date;
  modifiedGmt: Date;
  slug: string;
  status: string;
  title: {
    french: string;
    english: string;
    spanish: string;
  };
  content?: {
    french?: string;
    english?: string;
    spanish?: string;
  };
  excerpt: {
    french: string;
    english: string;
    spanish: string;
  };
  author: IPostAuthor;
  authors: IPostAuthor[];
  featuredMedia?: IPostMedia;
  media: IPostMedia[];
  categories: IPostCategory[];
  tags: IPostTag[];
  countries: IPostCategory[];
  postPrestige: string;
  price?: number;
  currency?: "EUR" | "USD" | "XAF" | "XOF";
  viewCount?: string;
  personalitiesID: string;
  personalities: IPostPersonnality[];
}

/**
 * Convert a prisma request to a readable response
 *
 * @param item prisma request result
 * @returns IPost
 */
export function toIOpinion(
  item: Pick<
    mod180_posts,
    | "ID"
    | "post_name"
    | "post_status"
    | "post_excerpt"
    | "post_title"
    | "post_date"
    | "post_date_gmt"
    | "post_modified"
    | "post_modified_gmt"
  > & { post_content?: string } & {
    author: Pick<mod180_users, "ID" | "display_name" | "user_nicename">;
    authors?: [];
    children?: (Pick<
      mod180_posts,
      | "ID"
      | "post_type"
      | "post_mime_type"
      | "post_title"
      | "post_excerpt"
      | "guid"
      | "post_date"
    > & { meta: Pick<mod180_postmeta, "meta_key" | "meta_value">[] })[];
    termRelationships?: {
      taxonomy: Pick<
        mod180_term_taxonomy,
        "count" | "description" | "taxonomy"
      > & {
        term: Pick<mod180_terms, "name" | "slug" | "term_id">;
      };
    }[];
  },
): IOpinion {
  const pItem = toSafeJSON(item);
  let authors = item.authors
    ? item.authors.map<IPostAuthor>(toIPostAuthor)
    : [item.author].map<IPostAuthor>(toIPostAuthor);

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
    slug: item.post_name,
    status: item.post_status,
    excerpt: {
      french: item.post_excerpt,
      english: pItem.meta.find(
        (m: { meta_key: string }) => m.meta_key === "description_eng",
      )?.meta_value,
      spanish: pItem.meta.find(
        (m: { meta_key: string }) => m.meta_key === "description_esp",
      )?.meta_value,
    },
    title: {
      french: item.post_title,
      english: pItem.meta.find(
        (m: { meta_key: string }) => m.meta_key === "titre_eng",
      )?.meta_value,
      spanish: pItem.meta.find(
        (m: { meta_key: string }) => m.meta_key === "titre_esp",
      )?.meta_value,
    },
    content: {
      french: item.post_content,
      english: pItem.meta.find(
        (m: { meta_key: string }) => m.meta_key === "version_anglaise",
      )?.meta_value,
      spanish: pItem.meta.find(
        (m: { meta_key: string }) => m.meta_key === "version_espagnole",
      )?.meta_value,
    },
    date: item.post_date_gmt! || item.post_date!,
    dateGmt: item.post_date_gmt!,
    modified: item.post_modified_gmt! || item.post_modified!,
    modifiedGmt: item.post_modified_gmt!,
    tags: (
      item.termRelationships?.filter(
        (item) => item.taxonomy?.taxonomy === "post_tag",
      ) ?? []
    ).map<IPostTag>((item) => {
      return toIPostTag(item.taxonomy);
    }),
    categories: (
      item.termRelationships?.filter(
        (item) => item.taxonomy?.taxonomy === "category",
      ) ?? []
    ).map<IPostCategory>((item) => {
      return toIPostCategory(item.taxonomy);
    }),
    countries: (
      item.termRelationships?.filter(
        (item) => item.taxonomy?.taxonomy === "country",
      ) ?? []
    ).map<IPostCategory>((item) => {
      return toIPostCategory(item.taxonomy);
    }),
    author: authors[0],
    authors,
    media,
    featuredMedia: media[0],
    postPrestige: pItem.meta.find(
      (m: { meta_key: string }) => m.meta_key === "post_prestige",
    )?.meta_value,
    price: pItem.meta.find((m: { meta_key: string }) => m.meta_key === "prix")
      ?.meta_value,
    currency: pItem.meta.find(
      (m: { meta_key: string }) => m.meta_key === "currency",
    )?.meta_value,
    viewCount: pItem.meta.find(
      (m: { meta_key: string }) => m.meta_key === "view_count",
    )?.meta_value,
    personalitiesID: pItem.meta.find(
      (m: { meta_key: string }) => m.meta_key === "view_count",
    )?.meta_value,
    personalities: [],
  };
}

export function toUpdateOpinion(
  item: IOpinion,
  personnalities: IPostPersonnality[],
): IOpinion {
  item.personalities = personnalities;
  return {
    ...item,
  };
}
