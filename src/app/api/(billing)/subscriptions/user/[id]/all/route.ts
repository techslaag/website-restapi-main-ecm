import IPaginateResponse from "@/interfaces/IPaginateResponse";
import authMiddleware from "@/lib/auth/authMiddleware";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { Prisma, Subscription } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: userId } }: { params: { id: string } },
) {
  return authMiddleware(req, async (user) => {
    /**
     * IMPORTANT
     * =================================================
     * This endpoint display all the user's subscriptions
     * -
     * Only administrator or the current user can have access to this resource
     *
     */

    if (user.admin || user.id === userId) {
      // extract query parameters
      const queryParams = extractQueryParams(req);

      const page = Number(queryParams.page ?? 1),
        limit = Number(queryParams.limit ?? 25);

      // query filter
      const whereQuery: Prisma.SubscriptionWhereInput = {
        userId,
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
        // must change 'include' to 'select' as soon as possible to prevent sensible information to be exclude
        include: {
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
    } else {
      return Response.json(
        {
          message: "Vous n'êtes pas autorisé à accéder à cette ressource.",
        },
        {
          status: 403,
        },
      );
    }
  });
}
