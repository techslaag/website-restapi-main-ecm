import {
  parseProduct,
  parseUpdateCover,
  parseUpdateCovernFileProduct,
} from "@/lib/DataParsers";
import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils";
import { Prisma, mod180_postmeta, mod180_posts } from "@prisma/client";

export default interface IProduct {
  id: number;
  name: string;
  description: string;
  post_content: string;
  publicationDate: string;
  productType: "bihebdomadaire" | "magazine" | "hors-serie";
  publicationNumber: string;
  price: string;
  currency: string;
  coverId: number;
  coverUrl: string;
  integrationMode: "pdf" | "iframe" | "link";
  fileContentId: number;
  fileContentUrl: string;
  iframe: string;
  iframePreview: string;
  link: string;
  linkPreview?: string;
  meta?: {
    pages: number;
  };
}

export const PRODUCT_PUBLIC_SELECT_INPUT = {
  ID: true,
  post_name: true,
  post_title: true,
  post_date: true,
  post_excerpt: true,
  post_content: true,
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
 * @param product post data
 * @returns
 */
export async function toIProduct(
  product:
    | null
    | (Pick<
        mod180_posts,
        | "ID"
        | "post_date"
        | "post_date_gmt"
        | "post_title"
        | "post_excerpt"
        | "post_content"
        | "post_name"
        | "post_modified"
        | "post_modified_gmt"
      > & {
        meta: Pick<mod180_postmeta, "meta_key" | "meta_value">[];
      }),
) {
  const formattedResponse = toSafeJSON(parseProduct(product));

  const cover = await prisma.mod180_posts.findUnique({
    where: {
      ID: Number(formattedResponse.coverId),
      post_type: "attachment",
      post_status: "inherit",
    },
    select: {
      guid: true,
    },
  });

  const formattedCover = toSafeJSON(cover);
  const integrationMode = formattedResponse.integrationMode;

  const isIntegrationMode = !!integrationMode;
  const isPdfIntegrationMode = isIntegrationMode
    ? integrationMode === "pdf"
    : true;

  console.log("Value of isIntegrationMode : ", isPdfIntegrationMode);

  if (isPdfIntegrationMode) {
    const file = await prisma.mod180_posts.findUnique({
      where: {
        ID: Number(formattedResponse.fileContentId),
        post_type: "attachment",
        post_status: "inherit",
      },
      select: {
        guid: true,
      },
    });
    const formattedFile = toSafeJSON(file);

    return parseUpdateCovernFileProduct(
      formattedResponse,
      formattedCover.guid,
      formattedFile.guid,
    );
  }

  return parseUpdateCover(formattedResponse, formattedCover.guid);
}
