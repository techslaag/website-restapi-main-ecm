import IPaginateResponse from "@/interfaces/IPaginateResponse";
import adminMiddleware from "@/lib/auth/adminMiddleware";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { Prisma, Subscription } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return adminMiddleware(req, async () => {
    // extract query parameters
    const queryParams = extractQueryParams(req);

    const page = Number(queryParams.page ?? 1),
      limit = Number(queryParams.limit ?? 25);
    const search = queryParams.search;

    const whereQuery: Prisma.SubscriptionWhereInput = {};
    
    // Add search functionality
    if (search) {
      whereQuery.OR = [
        {
          reference: {
            contains: search,
          },
        },
        {
          user: {
            email: {
              contains: search,
            },
          },
        },
        {
          user: {
            name: {
              contains: search,
            },
          },
        },
        {
          plan: {
            title: {
              contains: search,
            },
          },
        },
      ];
    }

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
        payment: true,
        plan: true,
        user: true
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
