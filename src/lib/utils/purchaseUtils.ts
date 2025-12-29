import { parseProduct } from "@/lib/DataParsers";
import prisma from "@/lib/prisma";
import { Prisma, PurchaseEntityType } from "@prisma/client";
import { serializeError } from "serialize-error";

export const PRODUCT_PURCHASE_PUBLIC_SELECT_INPUT = {
  id: true,
  createdAt: true,
  updatedAt: true,
  payment: true,
  entityType: true,
  user: true,
  post: {
    select: {
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
    },
  },
} as const satisfies Prisma.PurchaseSelect;

type RelatedProduct =
  | {
      type: "post";
      data?: {
        title: string;
        slug: string;
      };
      details: {
        label: string;
        subject: string;
        url?: string;
      };
    }
  | {
      type: "magazine" | "biweekly" | "special_issues";
      data?: {
        title: string;
        id: string;
      };
      details: {
        label: string;
        subject: string;
        url?: string;
      };
    }
  | {
      type: "packagefw";
      data?: {
        title: string;
        id: string;
      };
      details: {
        label: string;
        subject: string;
        url?: string;
      };
    };

export function fetchPurchaseProductDetail(entityType: PurchaseEntityType): {
  label: string;
  subject: string;
  url?: string;
} {
  switch (entityType) {
    case "biweekly":
      return {
        label: "bihedomadaire",
        subject: "Bihedomadaire acheté",
      };

    case "magazine":
      return {
        label: "magazine",
        subject: "Magazine acheté",
      };

    case "special_issues":
      return {
        label: "hors-série",
        subject: "Hors-série acheté",
      };

    case "post":
      return {
        label: "article",
        subject: "Article acheté",
      };

    case "packagefw":
      return {
        label: "package",
        subject: "package Finance Week 2024 acheté",
      };
  }
}

export async function fetchPurchaseRelatedProduct(
  entityType: PurchaseEntityType,
  entityId: string,
): Promise<RelatedProduct> {
  let productData: RelatedProduct = {
    type: entityType,
    details: fetchPurchaseProductDetail(entityType),
  };
  switch (entityType) {
    case "post": {
      try {
        // load post
        const post = await prisma.mod180_posts.findFirst({
          where: { ID: Number(entityId) },
        });

        // post exists
        if (post) {
          productData.data = {
            slug: post.post_name,
            title: post.post_title,
          };
        }
      } catch (error) {
        console.log("entity type error", entityType, serializeError(error));
      }
      break;
    }

    case "biweekly":
    case "magazine":
    case "special_issues": {
      try {
        // load product
        const product = await prisma.mod180_posts.findUnique({
          where: {
            ID: Number(entityId),
          },
          select: {
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
          },
        });

        if (product) {
          // parsed post
          const parsedPost = parseProduct(product);

          productData.data = {
            title: `${productData.details.label} N°${parsedPost.publicationNumber}`,
            id: product.ID.toString(),
          };
        }
      } catch (error) {
        console.log("entity type error", entityType, serializeError(error));
      }
      break;
    }
  }

  return productData;
}
