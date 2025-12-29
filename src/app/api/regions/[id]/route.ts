import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils";
import IRegion, { toIRegion } from "@/interfaces/IRegion";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: regionId } }: { params: { id: string } },
) {
  const region = await prisma.region.findUnique({
    where: { id: regionId },
    include: {
      country: true,
      departments: true,
    },
  });

  // region exists
  if (region) {
    return Response.json(toSafeJSON<IRegion>(toIRegion(region)));
  } else {
    return Response.json(
      {
        message: "Region introuvable.",
      },
      { status: 200 },
    );
  }
}
