import IPaginateResponse from "@/interfaces/IPaginateResponse";
import adminMiddleware from "@/lib/auth/adminMiddleware";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { PaymentProvider, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return adminMiddleware(req, async () => {
    // extract query parameters
    const queryParams = extractQueryParams(req);

    const page = Number(queryParams.page ?? 1),
      limit = Number(queryParams.limit ?? 25);

    const whereQuery: Prisma.PaymentProviderWhereInput = {};

    // get the pagination meta data (page, limit, total pages)
    const paginationMeta = await getPaginationMetaData(
      "PaymentProvider",
      page,
      limit,
      whereQuery,
    );

    const list = await prisma.paymentProvider.findMany({
      where: whereQuery,
      ...paginationMeta.query,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            payments: true,
          },
        },
      },
    });

    return Response.json(
      toSafeJSON<IPaginateResponse<PaymentProvider>>({
        ...paginationMeta.meta,
        items: list,
      }),
    );
  });
}
