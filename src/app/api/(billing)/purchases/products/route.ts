import IPaginateResponse from "@/interfaces/IPaginateResponse";
import IProduct from "@/interfaces/IProduct";
import { parseProduct } from "@/lib/DataParsers";
import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import { excludeProps, extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { PRODUCT_PURCHASE_PUBLIC_SELECT_INPUT } from "@/lib/utils/purchaseUtils";
import { Prisma, Purchase } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return adminMiddleware(req, async () => {
    // extract query parameters
    const queryParams = extractQueryParams(req);

    const page = Number(queryParams.page ?? 1),
      limit = Number(queryParams.limit ?? 25);

    const whereQuery: Prisma.PurchaseWhereInput = {
      entityType: {
        in: ["biweekly", "magazine", "special_issues"],
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
      select: PRODUCT_PURCHASE_PUBLIC_SELECT_INPUT,
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
              product: IProduct;
            })[] = [];

            for (const item of list) {
              const parsedProduct = parseProduct(item.post);

              const attachments = await prisma.mod180_posts.findMany({
                where: {
                  ID: {
                    in: [
                      Number(parsedProduct.coverId),
                      Number(parsedProduct.fileContentId),
                    ],
                  },
                  post_type: "attachment",
                  post_status: "inherit",
                },
                select: {
                  ID: true,
                  guid: true,
                },
              });

              const formattedCover = attachments.find(
                (item) =>
                  item.ID.toString() === parsedProduct.coverId.toString(),
              );

              if (formattedCover) {
                Object.assign(parsedProduct, {
                  coverUrl: formattedCover.guid,
                });
              }

              const formattedFile = attachments.find(
                (item) =>
                  item.ID.toString() === parsedProduct.fileContentId.toString(),
              );

              if (formattedFile) {
                Object.assign(parsedProduct, {
                  fileContentUrl: formattedFile.guid,
                });
              }

              result.push({
                ...excludeProps(item, ["post"]),
                product: parsedProduct,
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
