import prisma from "@/lib/prisma";
import { toIProductsInCities } from "@/interfaces/IProductsInCities";
import { extractQueryParams } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request, params: { params: { id: string } }) {
  const ids = params.params.id.split("_");
  const productInCity = await prisma.productInCity.findUnique({
    where: {
      ProductInCityId: {
        cityId: ids[0],
        productId: ids[1],
      },
    },
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
    return Response.json(toIProductsInCities(productInCity));
  } else {
    return Response.json(
      {
        message: "Produit introuvable dans la ville.",
      },
      { status: 404 },
    );
  }
}
