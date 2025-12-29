import IPaginateResponse from "@/interfaces/IPaginateResponse";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { extractQueryParams, toSafeJSON } from "@/lib/utils";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import { toICommune } from "@/interfaces/ICommune";

export const dynamic = "force-dynamic";

export async function GET(req: Request, res: Response) {
  const queryParams = extractQueryParams(req);

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);

  const whereQuery: Prisma.CommuneWhereInput = {};
  const paginateMeta = await getPaginationMetaData(
    "Commune",
    page,
    limit,
    whereQuery,
  );

  const communes = await prisma.commune.findMany({
    where: whereQuery,
    ...paginateMeta.query,
    orderBy: {
      id: "desc",
    },
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
      neighborhoods: true,
      productOnPrice: true,
    },
  });

  if (communes === null) {
    return Response.json("Commune not found", { status: 200 });
  }

  const parsedCommunes = communes.map((commune) =>
    toICommune(toSafeJSON(commune)),
  );

  return Response.json(
    toSafeJSON<IPaginateResponse<any>>({
      ...paginateMeta.meta,
      items: parsedCommunes,
    }),
  );
}
