import prisma from "@/lib/prisma";
import { toINeighborhood } from "@/interfaces/INeighborhood";
import { extractQueryParams, toSafeJSON } from "@/lib/utils";
import IPaginateResponse from "@/interfaces/IPaginateResponse";
import { Prisma } from "@prisma/client";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: communeId } }: { params: { id: string } },
) {
  const queryParams = extractQueryParams(req);

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);

  const whereQuery: Prisma.NeighborhoodWhereInput = {
    communeId,
  };
  const paginateMeta = await getPaginationMetaData(
    "Neighborhood",
    page,
    limit,
    whereQuery,
  );

  const neighborhoods = await prisma.neighborhood.findMany({
    where: whereQuery,
    ...paginateMeta.query,
  });

  if (neighborhoods === null) {
    return Response.json("Pas de quartier pour cette commune", { status: 200 });
  }

  const parsedNeighborhoods = neighborhoods.map(toINeighborhood);

  return Response.json(
    toSafeJSON<IPaginateResponse<any>>({
      ...paginateMeta.meta,
      items: parsedNeighborhoods,
    }),
  );
}
