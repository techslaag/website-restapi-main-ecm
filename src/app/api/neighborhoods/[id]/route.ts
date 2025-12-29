import prisma from "@/lib/prisma";
import { toINeighborhood } from "@/interfaces/INeighborhood";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: neighborhoodId } }: { params: { id: string } },
) {
  const neighborhood = await prisma.neighborhood.findUnique({
    where: { id: neighborhoodId },
    include: {
      commune: {
        include: {
          department: {
            include: {
              region: {
                include: {
                  country: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // region exists
  if (neighborhood) {
    return Response.json(toINeighborhood(neighborhood));
  } else {
    return Response.json(
      {
        message: "Quatier introuvable.",
      },
      { status: 200 },
    );
  }
}
