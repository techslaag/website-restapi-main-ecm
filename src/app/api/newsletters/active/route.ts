import authMiddleware from "@/lib/auth/authMiddleware";
import prisma from "@/lib/prisma";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return authMiddleware(request, async (user) => {
    try {
      // load all active newsletters
      const response = await prisma.newsletter.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          users: {
            where: { userId: user.id },
            select: {
              userId: true,
              usedEmail: true,
              assignedAt: true,
            },
          },
        },
      });

      return Response.json(response);
    } catch (error) {
      return Response.json(serializeError(error), {
        status: 500,
      });
    }
  });
}
