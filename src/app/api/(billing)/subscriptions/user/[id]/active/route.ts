import IPaginateResponse from "@/interfaces/IPaginateResponse";
import authMiddleware from "@/lib/auth/authMiddleware";
import prisma from "@/lib/prisma";
import { activeSubscriptionWhereInput, subscriptionPublicSelectInput } from "@/lib/utils/subscriptionUtils";
import { toSafeJSON } from "@/lib/utils/index";
import { Subscription } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: userId } }: { params: { id: string } },
) {
  return authMiddleware(req, async (user) => {
    /**
     * IMPORTANT
     * =================================================
     * This endpoint display all the user's current subscription
     * -
     * Only administrator or the current user can have access to this resource
     *
     */

    if (user.admin || user.id === userId) {
      // last subscription related to a payment with the status succeeded or processing
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          ...activeSubscriptionWhereInput,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: subscriptionPublicSelectInput,
      });

      return Response.json(
        toSafeJSON<IPaginateResponse<Subscription | null>>(subscription),
      );
    } else {
      return Response.json(
        {
          message: "Vous n'êtes pas autorisé à accéder à cette ressource.",
        },
        {
          status: 403,
        },
      );
    }
  });
}
