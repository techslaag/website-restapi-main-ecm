import IPaginateResponse from "@/interfaces/IPaginateResponse";
import { toIPost } from "@/interfaces/IPost";
import adminMiddleware from "@/lib/auth/adminMiddleware";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { Prisma, Purchase } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return adminMiddleware(req, async () => {
    // extract query parameters
    const queryParams = extractQueryParams(req);

    const page = Number(queryParams.page ?? 1),
      limit = Number(queryParams.limit ?? 25);

    const whereQuery: Prisma.PurchaseWhereInput = {
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
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        payment: true,
        user: true,
        post: {
          select: {
            ID: true,
            post_name: true,
            post_status: true,
            post_excerpt: true,
            post_title: true,
            post_date: true,
            post_date_gmt: true,
            post_modified: true,
            post_modified_gmt: true,
            archived: true,
            archivedAt: true,
            termRelationships: {
              select: {
                taxonomy: {
                  select: {
                    taxonomy: true,
                    count: true,
                    description: true,
                    term: {
                      select: {
                        term_id: true,
                        name: true,
                        slug: true,
                      },
                    },
                  },
                },
              },
            },
            children: {
              select: {
                ID: true,
                guid: true,
                post_type: true,
                post_excerpt: true,
                post_mime_type: true,
                post_title: true,
                post_date: true,
                meta: {
                  select: {
                    meta_key: true,
                    meta_value: true,
                  },
                },
              },
            },
            meta: true,
            author: {
              select: {
                ID: true,
                display_name: true,
                user_nicename: true,
              },
            },
          },
        },
      },
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
