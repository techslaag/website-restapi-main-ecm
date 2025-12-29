import { PRODUCT_PUBLIC_SELECT_INPUT, toIProduct } from "@/interfaces/IProduct";
import prisma from "@/lib/prisma";
import { extractQueryParams } from "@/lib/utils/index";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { type: string } },
) {
  const queryParams = extractQueryParams(req);
  const type = params.type;

  if (queryParams.page && !Number(queryParams.page)) {
    return Response.json(
      {
        error: "Invalid page number",
      },
      {
        status: 400,
      },
    );
  }

  const whereQuery: Prisma.mod180_postsWhereInput = {
    post_type: "brand-product",
    post_status: "publish",
    meta: {
      some: {
        meta_key: "product_type",
        meta_value: type,
      },
    },
  };

  const product = await prisma.mod180_posts.findFirst({
    where: whereQuery,
    orderBy: {
      post_date_gmt: "desc",
    },
    select: PRODUCT_PUBLIC_SELECT_INPUT,
  });

  if (product) {
    return Response.json(await toIProduct(product));
  } else {
    return Response.json(null);
  }
}
