import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const plans = await prisma.plan.findMany({
        where: {
          archivedAt: null,
        },
        select: {
          id: true,
          title: true,
          description: true,
          monthlyPrice: true,
          yearlyPrice: true,
          amountCurrency: true,
          planType: true,
        },
        orderBy: {
          monthlyPrice: "asc",
        },
      });

      const serializedPlans = plans.map(plan => ({
        ...plan,
        monthlyPrice: plan.monthlyPrice.toNumber(),
        yearlyPrice: plan.yearlyPrice.toNumber(),
        type: plan.planType,
        isActive: true,
      }));

      return Response.json({
        plans: serializedPlans,
        message: `${serializedPlans.length} plans disponibles`,
      });
    } catch (error) {
      console.error("Error fetching available plans:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}