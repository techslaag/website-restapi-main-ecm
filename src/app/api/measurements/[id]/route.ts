import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: measurementId } }: { params: { id: string } },
) {
  const measurement = await prisma.measurement.findUnique({
    where: { id: measurementId },
    select: {},
  });

  // region exists
  if (measurement) {
    return Response.json(measurement);
  } else {
    return Response.json(
      {
        message: "Unite de mesure de Produit et/ou Energie introuvable.",
      },
      { status: 404 },
    );
  }
}
