import IPaginateResponse from "@/interfaces/IPaginateResponse";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { extractQueryParams, toSafeJSON } from "@/lib/utils";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import { toIProductsInCities } from "@/interfaces/IProductsInCities";

export const dynamic = "force-dynamic";

export async function GET(req: Request, res: Response) {
  const queryParams = extractQueryParams(req);

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);

  const whereQuery: Prisma.ProductInCityWhereInput = {};
  const paginateMeta = await getPaginationMetaData(
    "ProductInCity",
    page,
    limit,
    whereQuery,
  );

  const productsInCities = await prisma.productInCity.findMany({
    where: whereQuery,
    ...paginateMeta.query,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      // city: true,
      // product: {
      //   include: {
      //     unitOfMeasurement: true,
      //   },
      // },
    },
  });

  if (productsInCities === null) {
    return Response.json("No products in cities found", {
      status: 200,
    });
  }

  const parsedProductsInCities = productsInCities.map((productInCity) =>
    toIProductsInCities(productInCity),
  );

  return Response.json(
    toSafeJSON<IPaginateResponse<any>>({
      ...paginateMeta.meta,
      items: parsedProductsInCities,
    }),
  );
}
