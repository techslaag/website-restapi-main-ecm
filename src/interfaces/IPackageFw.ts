import { parsePackageFw } from "@/lib/DataParsers";
import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils";
import { Prisma, mod180_postmeta, mod180_posts } from "@prisma/client";

export default interface IPackage {
  id: number;
  name: string;
  description: string;
  price: string;
  currency: string;
  archivedAt: string;
  meta?: {
    pages: number;
  };
}

export const PACKAGE_PUBLIC_SELECT_INPUT = {
  ID: true,
  post_name: true,
  post_title: true,
  post_date: true,
  post_excerpt: true,
  post_date_gmt: true,
  post_modified: true,
  post_modified_gmt: true,
  meta: {
    select: {
      meta_key: true,
      meta_value: true,
    },
  },
} as const satisfies Prisma.mod180_postsSelect;

/**
 * This function must be optimize to prevent multiple aditional call
 * @param package post data
 * @returns
 */
export function toIPackage(
  packageFw:
    | null
    | (Pick<
        mod180_posts,
        | "ID"
        | "post_date"
        | "post_date_gmt"
        | "post_title"
        | "post_excerpt"
        | "post_name"
        | "post_modified"
        | "post_modified_gmt"
      > & {
        meta: Pick<mod180_postmeta, "meta_key" | "meta_value">[];
      }),
) {
  return toSafeJSON(parsePackageFw(packageFw));
}
