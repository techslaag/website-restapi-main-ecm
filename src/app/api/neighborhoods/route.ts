import IPaginateResponse from "@/interfaces/IPaginateResponse";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { extractQueryParams, toSafeJSON } from "@/lib/utils";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import { toINeighborhood } from "@/interfaces/INeighborhood";

export const dynamic = "force-dynamic";

export async function GET(req: Request, res: Response) {
  const queryParams = extractQueryParams(req);

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);

  const whereQuery: Prisma.NeighborhoodWhereInput = {};
  const paginateMeta = await getPaginationMetaData(
    "Neighborhood",
    page,
    limit,
    whereQuery,
  );

  const neighborhoods = await prisma.neighborhood.findMany({
    where: whereQuery,
    ...paginateMeta.query,
    orderBy: {
      id: "desc",
    },
    include: {
      commune: {
        include: {
          department: {
            include: {
              communes: true,
              region: {
                include: {
                  departments: true,
                  country: true,
                },
              },
            },
          },
        },
      },
      predecessor: true,
      successor: true,
    },
  });

  if (neighborhoods === null) {
    return Response.json({ error: "Neighborhood not found" }, { status: 200 });
  }

  const parsedNeighborhoods = neighborhoods.map((neighborhood) =>
    toINeighborhood(toSafeJSON(neighborhood)),
  );

  return Response.json(
    toSafeJSON<IPaginateResponse<any>>({
      ...paginateMeta.meta,
      items: parsedNeighborhoods,
    }),
  );
}
