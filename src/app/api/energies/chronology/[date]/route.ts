import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils";
import IPaginateResponse from "@/interfaces/IPaginateResponse";
import { Prisma } from "@prisma/client";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import { toIEnergy } from "@/interfaces/IEnergy";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { date: dateString } }: { params: { date: string } },
) {
  const queryParams = extractQueryParams(req);

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);

  let date;
  try {
    date = new Date(dateString);
  } catch (error) {
    return Response.json(
      {
        message: "Date invalide.",
      },
      { status: 400 },
    );
  }
  const whereQuery: Prisma.EnergyWhereInput = { createdAt: { lte: date } };
  const paginateMeta = await getPaginationMetaData(
    "Energy",
    page,
    limit,
    whereQuery,
  );

  const energies = await prisma.energy.findMany({
    where: whereQuery,
    ...paginateMeta.query,
    include: {
      country: true,
      measurement: true,
    },
  });

  // energy exists
  if (energies) {
    let parsedEnergies = energies.map(toIEnergy);
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
  } else {
    return Response.json(
      {
        message: "Pas d'Energies enregistrées avant la date indiquée.",
      },
      { status: 200 },
    );
  }
}
