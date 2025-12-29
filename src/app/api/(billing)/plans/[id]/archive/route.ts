import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params: { id: planId } }: { params: { id: string } },
) {
  return adminMiddleware(req, async (user) => {
    // load plan
    const plan = await prisma.plan.findUnique({ where: { id: planId } });

    // plan exists
    if (plan) {
      // archive a plan
      await prisma.plan.update({
        where: { id: planId },
        data: {
          updatedAt: new Date(),
          archivedAt: new Date(),
          updatedById: user.id,
        },
      });

      return new Response(undefined, { status: 204 });
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
