import prisma from "@/lib/prisma";
import { toIProductsInCities } from "@/interfaces/IProductsInCities";
import { extractQueryParams, toSafeJSON } from "@/lib/utils";
import IPaginateResponse from "@/interfaces/IPaginateResponse";
import { Prisma } from "@prisma/client";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: productId } }: { params: { id: string } },
) {
  const queryParams = extractQueryParams(req);

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);

  const whereQuery: Prisma.ProductInCityWhereInput = { productId: productId };
  const paginateMeta = await getPaginationMetaData(
    "ProductInCity",
    page,
    limit,
    whereQuery,
  );

  const productInCity = await prisma.productInCity.findMany({
    where: whereQuery,
    ...paginateMeta.query,
    include: {
      city: true,
      product: {
        include: {
          unitOfMeasurement: true,
        },
      },
    },
  });

  // region exists
  if (productInCity) {
    const parsedProductInCity = productInCity.map(toIProductsInCities);
    return Response.json(
      toSafeJSON<IPaginateResponse<any>>({
        ...paginateMeta.meta,
        items: parsedProductInCity,
      }),
    );
  } else {
    return Response.json(
      {
        message: "Prix pour le produit introuvable dans les localités du pays.",
      },
      { status: 200 },
    );
  }
}
