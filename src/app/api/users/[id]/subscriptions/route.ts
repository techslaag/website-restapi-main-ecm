import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const userId = params.id;

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return Response.json(
          { error: "Utilisateur non trouvé" },
          { status: 404 }
        );
      }

      // Get all subscriptions for this user
      const subscriptions = await prisma.subscription.findMany({
        where: { userId },
        include: {
          plan: {
            select: {
              id: true,
              title: true,
              planType: true,
              description: true,
            }
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Handle potential null plan relationships
      const subscriptionsWithSanitizedPlans = subscriptions.map(subscription => ({
        ...subscription,
        plan: subscription.plan || null,
      }));

      return Response.json(subscriptionsWithSanitizedPlans);
    } catch (error) {
      console.error("Error fetching user subscriptions:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}