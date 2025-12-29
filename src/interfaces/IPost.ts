import IPostPersonnality from "@/interfaces/IPostPersonnality";
import {
  mod180_postmeta,
  mod180_posts,
  mod180_term_taxonomy,
  mod180_termmeta,
  mod180_terms,
  mod180_users,
} from "@prisma/client";
import IPostAuthor, { toIPostAuthor } from "./IPostAuthor";
import IPostCategory, { toIPostCategory } from "./IPostCategory";
import IPostMedia from "./IPostMedia";
import IPostTag, { toIPostTag } from "./IPostTag";

export interface I18N {
  title: string;
  content?: string;
  excerpt: string;
}

export default interface IPost {
  id: string;
  date: Date;
  dateGmt: Date;
  modified: Date;
  modifiedGmt: Date;
  slug: string;
  status: string;
  title: string;
  content?: string;
  excerpt?: string | null;
  author: IPostAuthor;
  authors: IPostAuthor[];
  featuredMedia?: IPostMedia;
  featuredMediaId?: string | null;
  media: IPostMedia[];
  categories: IPostCategory[];
  tags: IPostTag[];
  countries: IPostCategory[];
  postPrestige?: "ecomembre" | "premium" | "gratuit" | null;
  price?: string | null;
  currency?: "EUR" | "USD" | "XAF" | "XOF" | null;
  viewCount?: string | null;
  i18nSpanish?: I18N;
  i18nEnglish?: I18N;
  personalitiesID?: string | null;
  personalities?: IPostPersonnality[];
  postOpinionType?: "opinion" | "edito" | "tribune" | null;
  archived?: boolean | null;
  archivedAt?: Date | null;
  position: number;
  c_position: number;
}

/**
 * Convert a prisma request to a readable response
 *
 * @param item prisma request result
 * @returns IPost
 */
export function toIPost(
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
    | "archived"
    | "archivedAt"
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
    > & { meta?: Pick<mod180_postmeta, "meta_key" | "meta_value">[] })[];
    meta?: Pick<mod180_postmeta, "meta_key" | "meta_value">[];
    termRelationships?: {
      taxonomy: Pick<
        mod180_term_taxonomy,
        "count" | "description" | "taxonomy"
      > & {
        term: Pick<mod180_terms, "name" | "slug" | "term_id"> & {
          meta?: Pick<mod180_termmeta, "meta_key" | "meta_value">[];
        };
      };
    }[];
  },
): IPost {
  // const item = toSafeJSON(item);
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

  const views = item?.meta?.find(
    (m) => m.meta_key === "view_count",
  )?.meta_value;
  let viewCount;

  if (views) {
    if (Number(views) === 0) {
      viewCount = item?.meta?.find(
        (m) => m.meta_key === "tie_views",
      )?.meta_value;
    } else {
      viewCount = views;
    }
  }

  // Determine post_opinion_type based on tag name
  let postOpinionType: "opinion" | "edito" | "tribune" | null = "opinion"; // default
  const tagNames = item.termRelationships
    ?.filter((item) => item.taxonomy?.taxonomy === "post_tag")
    ?.map((item) => item.taxonomy?.term?.name) ?? [];
  
  if (tagNames.some(name => name === "#cc-edito-cc#")) {
    postOpinionType = "edito";
  } else if (tagNames.some(name => name === "#cc-tribune-cc#")) {
    postOpinionType = "tribune";
  }

  return {
    id: item.ID.toString(),
    slug: item.post_name,
    status: item.post_status,
    excerpt: item.post_excerpt
      ? item.post_excerpt
      : item?.meta?.find((m) => m.meta_key === "tie_post_sub_title")
          ?.meta_value,
    title: item.post_title,
    content: item.post_content,
    date: item.post_date_gmt! || item.post_date!,
    dateGmt: item.post_date_gmt!,
    modified: item.post_modified_gmt! || item.post_modified!,
    modifiedGmt: item.post_modified_gmt!,
    archived: item.archived,
    archivedAt: item.archivedAt,
    tags: (
      item.termRelationships?.filter(
        (item) => item.taxonomy?.taxonomy === "post_tag",
      ) ?? []
    )
      .filter((item) => {
        // Filter out tags matching #cc-*-cc# pattern
        const tagName = item.taxonomy?.term?.name;
        const isControlTag = tagName && tagName.startsWith("#cc-") && tagName.endsWith("-cc#");
        return !isControlTag;
      })
      .map<IPostTag>((item) => {
        return toIPostTag(item.taxonomy);
      }),
    categories: (
      item.termRelationships?.filter((item) =>
        ["category", "affair", "classement"].includes(item.taxonomy?.taxonomy),
      ) ?? []
    )
      .filter((item) => {
        // Filter out categories matching #cc-*-cc# pattern
        const categoryName = item.taxonomy?.term?.name;
        const isControlCategory = categoryName && categoryName.startsWith("#cc-") && categoryName.endsWith("-cc#");
        return !isControlCategory;
      })
      .map<IPostCategory>((item) => {
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
    featuredMediaId: media[0]?.id 
      || item?.meta?.find((m) => m.meta_key === "_thumbnail_id")?.meta_value 
      || item?.meta?.find((m) => m.meta_key === "featured_image")?.meta_value
      || item?.meta?.find((m) => m.meta_key === "_featured_image")?.meta_value
      || item?.meta?.find((m) => m.meta_key === "post_image")?.meta_value
      || null,
    postPrestige: item?.meta?.find((m) => m.meta_key === "post_prestige")
      ?.meta_value as any,
    price: item?.meta?.find((m) => m.meta_key === "prix")?.meta_value,
    currency: item?.meta?.find((m) => m.meta_key === "currency")
      ?.meta_value as any,
    viewCount,
    personalitiesID: item.meta?.find((m) => m.meta_key === "view_count")
      ?.meta_value,
    personalities: [],
    postOpinionType,
    position: item.meta?.find((m) => m.meta_key === "position")?.meta_value 
      ? Number(item.meta?.find((m) => m.meta_key === "position")?.meta_value) : 0,
    c_position: item.meta?.find((m) => m.meta_key === "c_position")?.meta_value 
      ? Number(item.meta?.find((m) => m.meta_key === "c_position")?.meta_value)
      : 0,

    /**
     * Those information must be returned dynamically to the user according to the Accept-Language header
     * ----------------------------------------------------------------------------------------------------
     */

    // i18nSpanish: {
    //   title: item?.meta?.find(
    //     (m) => m.meta_key === "titre_eng",
    //   )?.meta_value,
    //   content: item?.meta?.find(
    //     (m) => m.meta_key === "version_espagnole",
    //   )?.meta_value,
    //   excerpt: item?.meta?.find(
    //     (m) => m.meta_key === "description_eng",
    //   )?.meta_value,
    // },
    // i18nEnglish: {
    //   title: item?.meta?.find(
    //     (m) => m.meta_key === "titre_eng",
    //   )?.meta_value,
    //   content: item?.meta?.find(
    //     (m) => m.meta_key === "version_anglaise",
    //   )?.meta_value,
    //   excerpt: item?.meta?.find(
    //     (m) => m.meta_key === "description_esp",
    //   )?.meta_value,
    // },
  };
}

export function toUpdatePost(item: IPost, featuredMedia: IPostMedia): IPost {
  item.featuredMedia = featuredMedia;
  item.media.push(featuredMedia);
  return {
    ...item,
  };
}

export function toUpdatePostMakeOpinion(
  item: IPost,
  personnalities: IPostPersonnality[],
): IPost {
  item.personalities = personnalities;
  return {
    ...item,
  };
}
