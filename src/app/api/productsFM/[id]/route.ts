import prisma from "@/lib/prisma";
import { toIProductFM } from "@/interfaces/IProductFM";
import { toSafeJSON } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: productId } }: { params: { id: string } },
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      unitOfMeasurement: true,
      communeOnPrice: {
        include: {
          city: true,
        },
      },
    },
  });

  // region exists
  if (product) {
    return Response.json(toIProductFM(product));
  } else {
    return Response.json(
      {
        message: "Produit introuvable.",
      },
      { status: 200 },
    );
  }
}
