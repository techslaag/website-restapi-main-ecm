import IPaginateResponse from "@/interfaces/IPaginateResponse";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { extractQueryParams, toSafeJSON } from "@/lib/utils";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import { toIProductFM } from "@/interfaces/IProductFM";

export const dynamic = "force-dynamic";

export async function GET(req: Request, res: Response) {
  const queryParams = extractQueryParams(req);

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);

  const whereQuery: Prisma.ProductWhereInput = {};
  const paginateMeta = await getPaginationMetaData(
    "Product",
    page,
    limit,
    whereQuery,
  );

  const productsFM = await prisma.product.findMany({
    where: whereQuery,
    ...paginateMeta.query,
    orderBy: {
      id: "desc",
    },
    include: {
      unitOfMeasurement: true,
      communeOnPrice: {
        include: {
          city: true,
        },
      },
    },
  });

  if (productsFM === null) {
    return Response.json("Products not found", { status: 200 });
  }

  const parsedProductsFM = productsFM.map((product) => toIProductFM(product));

  return Response.json(
    toSafeJSON<IPaginateResponse<any>>({
      ...paginateMeta.meta,
      items: parsedProductsFM,
    }),
  );
}
