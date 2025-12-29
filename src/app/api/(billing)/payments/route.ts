import IPaginateResponse from "@/interfaces/IPaginateResponse";
import adminMiddleware from "@/lib/auth/adminMiddleware";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return adminMiddleware(req, async () => {
    const queryParams = extractQueryParams(req);

    const page = Number(queryParams.page ?? 1),
      limit = Number(queryParams.limit ?? 25);

    const whereQuery: Prisma.PaymentWhereInput = {};

    // get the pagination meta data (page, limit, total pages)
    const paginationMeta = await getPaginationMetaData(
      "Payment",
      page,
      limit,
      whereQuery,
    );

    const payments = await prisma.payment.findMany({
      where: whereQuery,
      ...paginationMeta.query,
      orderBy: {
        id: "desc",
      },
      include: {
        subscriptions: true,
        purchases: true,
      },
    });

    return Response.json(
      toSafeJSON<IPaginateResponse<any>>({
        ...paginationMeta.meta,
        items: payments,
      }),
    );
  });
}
