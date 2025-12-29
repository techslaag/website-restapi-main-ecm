import IPaginateResponse from "@/interfaces/IPaginateResponse";
import IProduct, {
  PRODUCT_PUBLIC_SELECT_INPUT,
  toIProduct,
} from "@/interfaces/IProduct";
import prisma from "@/lib/prisma";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const queryParams = extractQueryParams(req);

  if (queryParams.page) {
    if (!Number(queryParams.page)) {
      return Response.json(
        {
          error: "Invalid page number",
        },
        {
          status: 400,
        },
      );
    }
  }

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);

  // Filter specifically for magazine-type products
  const whereQuery: Prisma.mod180_postsWhereInput = {
    post_type: "brand-product",
    post_status: "publish",
    meta: {
      some: {
        meta_key: "product_type",
        meta_value: "magazine"
      }
    }
  };

  const paginationMeta = await getPaginationMetaData(
    "mod180_posts",
    page,
    limit,
    whereQuery,
  );

  // Include post_content in the select statement
  const magazines = await prisma.mod180_posts.findMany({
    where: whereQuery,
    ...paginationMeta.query,
    orderBy: {
      post_date_gmt: "desc",
    },
    select: {
      ...PRODUCT_PUBLIC_SELECT_INPUT,
      post_content: true, // Add post_content to the response
    },
  });

  const parsedMagazines = await Promise.all(
    magazines.map(async (magazine) => {
      const productData = await toIProduct(magazine);
      return {
        ...productData,
        post_content: magazine.post_content, // Include post_content in response
      };
    }),
  );

  return Response.json(
    toSafeJSON<IPaginateResponse<IProduct & { post_content: string }>>({
      ...paginationMeta.meta,
      items: parsedMagazines,
    }),
  );
}