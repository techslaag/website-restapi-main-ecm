import IPaginateResponse from "@/interfaces/IPaginateResponse";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { extractQueryParams, toSafeJSON } from "@/lib/utils";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import { toIRegion } from "@/interfaces/IRegion";

export const dynamic = "force-dynamic";

export async function GET(req: Request, res: Response) {
  const queryParams = extractQueryParams(req);

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);

  const whereQuery: Prisma.RegionWhereInput = {};
  const paginateMeta = await getPaginationMetaData(
    "Region",
    page,
    limit,
    whereQuery,
  );

  const regions = await prisma.region.findMany({
    where: whereQuery,
    ...paginateMeta.query,
    orderBy: {
      id: "desc",
    },
    include: {
      departments: true,
      country: true,
    },
  });

  if (regions === null) {
    return Response.json({ error: "Regions not found" }, { status: 200 });
  }

  const parsedRegions = regions.map((region) => toIRegion(region));

  return Response.json(
    toSafeJSON<IPaginateResponse<any>>({
      ...paginateMeta.meta,
      items: parsedRegions,
    }),
  );
}
