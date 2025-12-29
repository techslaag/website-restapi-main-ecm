import { toStringOrUndefined } from "@/lib/utils/index";
import { mod180_term_taxonomy, mod180_terms } from "@prisma/client";

export default interface IPostTag {
  id: string;
  description?: string;
  name: string;
  slug: string;
  taxonomy: string;
  count?: number;
}

/**
 * Convert a prisma request to a readable response
 *
 * @param item prisma request result
 * @returns IPost
 */
export function toIPostTag(
  item: Pick<mod180_term_taxonomy, "taxonomy" | "count" | "description"> & {
    term: Pick<mod180_terms, "name" | "slug" | "term_id">;
  }
): IPostTag {
  return {
    id: item.term.term_id.toString(),
    name: item.term.name,
    slug: item.term.slug!,
    taxonomy: item.taxonomy!,
    count: Number(item.count?.toString()),
    description: toStringOrUndefined(item.description),
  };
}
