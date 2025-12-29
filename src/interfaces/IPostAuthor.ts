import { mod180_users } from "@prisma/client";

export interface AvatarUrls {
  "24": string;
  "48": string;
  "96": string;
}

export default interface IPostAuthor {
  id: string;
  name: string;
  description?: string;
  slug: string;
}

/**
 * Convert a prisma request to a readable response
 *
 * @param item prisma request result
 * @returns IPost
 */
export function toIPostAuthor(
  item: Pick<mod180_users, "ID" | "display_name" | "user_nicename">
): IPostAuthor {
  return {
    id: item.ID.toString(),
    name: item.display_name,
    slug: item.user_nicename,
  };
}
