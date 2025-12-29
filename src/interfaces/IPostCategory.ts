import { toSafeJSON, toStringOrUndefined } from "@/lib/utils/index";
import {
  mod180_term_taxonomy,
  mod180_termmeta,
  mod180_terms,
} from "@prisma/client";

export default interface IPostCategory {
  id: string;
  count?: number;
  description?: string;
  descriptionSpanish?: string;
  descriptionEnglish?: string;
  name: string;
  nameSpanish?: string;
  nameEnglish?: string;
  slug: string;
  taxonomy: string;
  parent?: number;
  _count?: any;
}

/**
 * Convert a prisma request to a readable response
 *
 * @param item prisma request result
 * @returns IPost
 */
export function toIPostCategory(
  item: Pick<mod180_term_taxonomy, "taxonomy" | "count" | "description"> & {
    term: Pick<mod180_terms, "name" | "slug" | "term_id"> & {
      meta?: Pick<mod180_termmeta, "meta_key" | "meta_value">[];
    };
    _count?: any;
  },
): IPostCategory {
  return {
    id: item.term.term_id.toString(),
    name: item.term.name,
    nameEnglish: toSafeJSON(item).term.meta?.find(
      (m: any) => m.meta_key === "english",
    )?.meta_value,
    nameSpanish: toSafeJSON(item).term.meta?.find(
      (m: any) => m.meta_key === "spanish",
    )?.meta_value,
    slug: item.term.slug,
    taxonomy: item.taxonomy,
    description: toStringOrUndefined(item.description),
    descriptionEnglish: toSafeJSON(item).term.meta?.find(
      (m: any) => m.meta_key === "english_description",
    )?.meta_value,
    descriptionSpanish: toSafeJSON(item).term.meta?.find(
      (m: any) => m.meta_key === "spanish_description",
    )?.meta_value,
    count: Number(item.count?.toString()),
    _count: item._count,
  };
}
