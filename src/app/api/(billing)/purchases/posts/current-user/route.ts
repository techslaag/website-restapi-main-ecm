import IPaginateResponse from "@/interfaces/IPaginateResponse";
import { toIPost } from "@/interfaces/IPost";
import authMiddleware from "@/lib/auth/authMiddleware";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { Prisma, Purchase } from "@prisma/client";
import postSelectOptions from "../postSelectOptions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return authMiddleware(req, async (user) => {
    // extract query parameters
    const queryParams = extractQueryParams(req);

    const page = Number(queryParams.page ?? 1),
      limit = Number(queryParams.limit ?? 25);

    // query filter
    const whereQuery: Prisma.PurchaseWhereInput = {
      userId: user.id,
      entityType: "post",
    };

    // get the pagination meta data (page, limit, total pages)
    const paginationMeta = await getPaginationMetaData(
      "Purchase",
      page,
      limit,
      whereQuery,
    );

    const list = await prisma.purchase.findMany({
      where: whereQuery,
      ...paginationMeta.query,
      orderBy: {
        createdAt: "desc",
      },
      select: postSelectOptions,
    });

    return Response.json(
      toSafeJSON<IPaginateResponse<Purchase>>({
        ...paginationMeta.meta,
        items: list.map((item) => ({
          ...item,
          post: toIPost(item.post),
        })),
      }),
    );
  });
}
