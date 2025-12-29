import IPaginateResponse from "@/interfaces/IPaginateResponse";
import authMiddleware from "@/lib/auth/authMiddleware";
import prisma from "@/lib/prisma";
import { activeSubscriptionWhereInput, subscriptionPublicSelectInput } from "@/lib/utils/subscriptionUtils";
import { toSafeJSON } from "@/lib/utils/index";
import { Subscription } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return authMiddleware(req, async (user) => {
    // last subscription related to a payment with the status succeeded or processing
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
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
  });
}
