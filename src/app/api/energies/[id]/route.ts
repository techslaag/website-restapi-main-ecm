import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { toIEnergy } from "@/interfaces/IEnergy";
import { toSafeJSON } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: energyId } }: { params: { id: string } },
) {
  const energy = await prisma.energy.findUnique({
    where: { id: energyId },
    include: {
      country: true,
      measurement: true,
    },
  });

  // plan exists
  if (energy) {
    return Response.json(toIEnergy(energy));
  } else {
    return Response.json(
      {
        message: "Energie introuvable.",
      },
      { status: 200 },
    );
  }
}
