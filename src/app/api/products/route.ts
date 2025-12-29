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

  const whereQuery: Prisma.mod180_postsWhereInput = {
    post_type: "brand-product",
    post_status: "publish",
  };

  const paginationMeta = await getPaginationMetaData(
    "mod180_posts",
    page,
    limit,
    whereQuery,
  );

  const products = await prisma.mod180_posts.findMany({
    where: whereQuery,
    ...paginationMeta.query,
    orderBy: {
      post_date_gmt: "desc",
    },
    select: PRODUCT_PUBLIC_SELECT_INPUT,
  });

  const parsedProducts = await Promise.all(
    products.map(async (product) => await toIProduct(product)),
  );

  return Response.json(
    toSafeJSON<IPaginateResponse<IProduct>>({
      ...paginationMeta.meta,
      items: parsedProducts,
    }),
  );
}
