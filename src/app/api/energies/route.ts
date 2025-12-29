import IPaginateResponse from "@/interfaces/IPaginateResponse";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { extractQueryParams, toSafeJSON } from "@/lib/utils";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import { toIEnergy } from "@/interfaces/IEnergy";

export const dynamic = "force-dynamic";

export async function GET(req: Request, res: Response) {
  const queryParams = extractQueryParams(req);

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);

  const whereQuery: Prisma.EnergyWhereInput = {
    successorId: { equals: null },
  };
  const paginateMeta = await getPaginationMetaData(
    "Energy",
    page,
    limit,
    whereQuery,
  );

  const energies = await prisma.energy.findMany({
    where: whereQuery,
    ...paginateMeta.query,
    orderBy: {
      id: "desc",
    },
    include: {
      country: true,
      measurement: true,
    },
  });

  if (energies === null) {
    return Response.json({ error: "Energy not found" }, { status: 200 });
  }

  const parsedEnergies = energies.map(toIEnergy);
  for (const energy of parsedEnergies) {
    const en = await prisma.energy.findUnique({
      where: { successorId: energy.id },
      include: {
        country: true,
        measurement: true,
      },
    });
    if (en) {
      const parsedEn = toIEnergy(en);
      energy.predecessorPrice = parsedEn.price;
    }
  }

  return Response.json(
    toSafeJSON<IPaginateResponse<any>>({
      ...paginateMeta.meta,
      items: parsedEnergies,
    }),
  );
}
