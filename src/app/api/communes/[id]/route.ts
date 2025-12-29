import prisma from "@/lib/prisma";
import { toICommune } from "@/interfaces/ICommune";
import { toSafeJSON } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: communeId } }: { params: { id: string } },
) {
  const commune = await prisma.commune.findUnique({
    where: { id: communeId },
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

  // region exists
  if (commune) {
    return Response.json(toICommune(commune));
  } else {
    return Response.json(
      {
        message: "Commune introuvable.",
      },
      { status: 200 },
    );
  }
}
