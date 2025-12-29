import adminMiddleware from "@/lib/auth/adminMiddleware";
import { serializeError } from "serialize-error";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return adminMiddleware(request, async (user) => {
    try {
      // Find users who have no subscriptions at all
      const usersWithoutSubscriptions = await prisma.user.findMany({
        where: {
          subscriptions: {
            none: {},
          },
        },
        select: {
          id: true,
          email: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const userIds = usersWithoutSubscriptions.map(user => user.id);
      const count = usersWithoutSubscriptions.length;

      console.log(`Found ${count} users without any subscriptions`);

      return Response.json({
        userIds,
        count,
        users: usersWithoutSubscriptions,
      });
    } catch (error) {
      console.error("Error fetching users without subscriptions:", error);
      return Response.json(serializeError(error), {
        status: 500,
      });
    }
  });
}