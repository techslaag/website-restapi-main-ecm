import IPaginateResponse from "@/interfaces/IPaginateResponse";
import adminMiddleware from "@/lib/auth/adminMiddleware";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { Prisma, Subscription } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: planId } }: { params: { id: string } },
) {
  return adminMiddleware(req, async () => {
    // extract query parameters
    const queryParams = extractQueryParams(req);

    const page = Number(queryParams.page ?? 1),
      limit = Number(queryParams.limit ?? 25);

    // query filter
    const whereQuery: Prisma.SubscriptionWhereInput = {
      planId,
    };

    // get the pagination meta data (page, limit, total pages)
    const paginationMeta = await getPaginationMetaData(
      "Subscription",
      page,
      limit,
      whereQuery,
    );

    const list = await prisma.subscription.findMany({
      where: whereQuery,
      ...paginationMeta.query,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: true,
        payment: true,
        plan: true,
      },
    });

    return Response.json(
      toSafeJSON<IPaginateResponse<Subscription>>({
        ...paginationMeta.meta,
        items: list,
      }),
    );
  });
}
