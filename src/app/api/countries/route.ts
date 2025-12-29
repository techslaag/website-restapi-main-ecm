import IPaginateResponse from "@/interfaces/IPaginateResponse";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { extractQueryParams, toSafeJSON } from "@/lib/utils";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import { toICountry } from "@/interfaces/ICountry";

export const dynamic = "force-dynamic";

export async function GET(req: Request, res: Response) {
  const queryParams = extractQueryParams(req);

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);

  const whereQuery: Prisma.CountryWhereInput = {};
  const paginateMeta = await getPaginationMetaData(
    "Country",
    page,
    limit,
    whereQuery,
  );

  const countries = await prisma.country.findMany({
    where: whereQuery,
    ...paginateMeta.query,
    orderBy: {
      id: "desc",
    },
    include: {
      energies: true,
      Region: true,
    },
  });

  if (countries === null) {
    return Response.json({ error: "Countries not found" }, { status: 200 });
  }

  const parsedCountries = countries.map((item) => toICountry(item));

  return Response.json(
    toSafeJSON<IPaginateResponse<any>>({
      ...paginateMeta.meta,
      items: parsedCountries,
    }),
  );
}
