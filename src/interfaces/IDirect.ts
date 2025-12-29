import { mod180_postmeta, mod180_posts, mod180_term_taxonomy, mod180_terms, mod180_users } from "@prisma/client";
import IPostMedia from "@/interfaces/IPostMedia";
import IPostAuthor from "@/interfaces/IPostAuthor";
import IPostTag from "@/interfaces/IPostTag";

export interface IDirectPost {
  title: string;
  content: string;
  isEssential: boolean;
  time: string;
}

export default interface IDirect {
  id: string;
  title: string;
  slug: string;
  content?: string;
  excerpt?: string;
  author?: IPostAuthor;
  tags: IPostTag[];
  date: Date;
  featuredImage?: IPostMedia;
  featuredImageId?: string;
  status: string;
  directPosts: IDirectPost[];
  directPostsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toIDirect(
  item: Pick<
    mod180_posts,
    "ID" | "post_date" | "post_date_gmt" | "post_title" | "post_status" | "post_modified" | "post_modified_gmt" | "post_name" | "post_excerpt" | "post_content"
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
    author?: Pick<mod180_users, "ID" | "display_name" | "user_nicename">;
    termRelationships?: {
      taxonomy: Pick<mod180_term_taxonomy, "taxonomy" | "count" | "description"> & {
        term: Pick<mod180_terms, "name" | "slug" | "term_id">;
      };
    }[];
  },
): IDirect {
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

  const featuredImageId = item.meta?.find(
    (m) => m.meta_key === "_thumbnail_id",
  )?.meta_value;

  const directPostsCount = parseInt(item.meta?.find(
    (m) => m.meta_key === "direct_posts",
  )?.meta_value || "0");

  // Parse ACF repeater fields for direct posts
  const directPosts: IDirectPost[] = [];
  for (let i = 0; i < directPostsCount; i++) {
    const title = item.meta?.find((m) => m.meta_key === `direct_posts_${i}_title`)?.meta_value || "";
    const content = item.meta?.find((m) => m.meta_key === `direct_posts_${i}_content`)?.meta_value || "";
    const isEssential = item.meta?.find((m) => m.meta_key === `direct_posts_${i}_is_essential`)?.meta_value === "1";
    const time = item.meta?.find((m) => m.meta_key === `direct_posts_${i}_time`)?.meta_value || "";
    
    if (title || content) {
      directPosts.push({
        title,
        content,
        isEssential,
        time,
      });
    }
  }

  // Sort directPosts by time in descending order
  directPosts.sort((a, b) => {
    // Convert time strings (HH:MM:SS) to comparable values
    const timeA = a.time.split(':').map(Number);
    const timeB = b.time.split(':').map(Number);
    
    // Compare hours, then minutes, then seconds
    for (let i = 0; i < 3; i++) {
      if (timeA[i] !== timeB[i]) {
        return timeB[i] - timeA[i]; // Descending order
      }
    }
    return 0;
  });

  const tags = item.termRelationships
    ?.filter((rel) => rel.taxonomy.taxonomy === "post_tag")
    .map((rel) => ({
      id: rel.taxonomy.term.term_id.toString(),
      name: rel.taxonomy.term.name,
      slug: rel.taxonomy.term.slug!,
      taxonomy: rel.taxonomy.taxonomy!,
      count: Number(rel.taxonomy.count?.toString()),
      description: rel.taxonomy.description,
    })) ?? [];

  return {
    id: item.ID.toString(),
    title: item.post_title,
    slug: item.post_name,
    content: item.post_content || undefined,
    excerpt: item.post_excerpt || undefined,
    author: item.author ? {
      id: item.author.ID.toString(),
      name: item.author.display_name,
      slug: item.author.user_nicename,
    } : undefined,
    tags,
    date: item.post_date_gmt! || item.post_date!,
    featuredImage: media.find((m) => m.id === featuredImageId),
    featuredImageId: featuredImageId || undefined,
    status: item.meta?.find((m) => m.meta_key === "actif")?.meta_value === "1" ? "actif" : "inactif",
    directPosts,
    directPostsCount,
    createdAt: item.post_date_gmt!,
    updatedAt: item.post_modified_gmt || item.post_date_gmt!,
  };
}

export function toUpdateIDirect(item: IDirect, image: IPostMedia): IDirect {
  item.featuredImage = image;
  return {
    ...item,
  };
}