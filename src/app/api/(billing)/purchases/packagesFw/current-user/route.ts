import IPaginateResponse from "@/interfaces/IPaginateResponse";
import { parsePackageFw } from "@/lib/DataParsers";
import authMiddleware from "@/lib/auth/authMiddleware";
import prisma from "@/lib/prisma";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import {
  excludeProps,
  extractQueryParams,
  toSafeJSON,
} from "@/lib/utils/index";
import { PRODUCT_PURCHASE_PUBLIC_SELECT_INPUT } from "@/lib/utils/purchaseUtils";
import { Prisma, Purchase } from "@prisma/client";
import IPackage from "@/interfaces/IPackageFw";

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
      entityType: {
        in: ["packagefw"],
      },
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
      select: excludeProps(PRODUCT_PURCHASE_PUBLIC_SELECT_INPUT, ["user"]),
    });

    /**
     * OPTIMIZATION REQUIRED HERE
     * ------------------------------------------
     * Only one request must get all the related cover and file content
     */
    return Response.json(
      toSafeJSON<IPaginateResponse<Purchase>>({
        ...paginationMeta.meta,
        items: await new Promise(async (resolve, reject) => {
          try {
            const result: (Omit<
              Purchase,
              "postId" | "paymentId" | "userId" | "updatedById"
            > & {
              product: IPackage;
            })[] = [];

            for (const item of list) {
              const parsedPackageFw = parsePackageFw(item.post);

              result.push({
                ...excludeProps(item, ["post"]),
                product: parsedPackageFw,
              });
            }

            resolve(result);
          } catch (error) {
            reject(error);
          }
        }),
      }),
    );
  });
}
