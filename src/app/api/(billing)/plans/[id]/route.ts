import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: planId } }: { params: { id: string } },
) {
  return adminMiddleware(req, async (user) => {
    // load plan
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: {},
    });

    // plan exists
    if (plan) {
      return Response.json(plan);
    } else {
      return Response.json(
        {
          message: "Offre introuvable.",
        },
        { status: 404 },
      );
    }
  });
}
