import IPaginateResponse from "@/interfaces/IPaginateResponse";
import authMiddleware from "@/lib/auth/authMiddleware";
import prisma from "@/lib/prisma";
import {
  activeSubscriptionWhereInput,
  subscriptionPublicSelectInput,
} from "@/lib/utils/subscriptionUtils";
import { toSafeJSON } from "@/lib/utils/index";
import { Currency, PurchaseEntityType, Subscription } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return authMiddleware(req, async (user) => {
    const purchases = await prisma.purchase.findMany({
      where: {
        userId: user.id,
        payment: { status: "succeeded" },
      },
      select: {
        entityType: true,
        postId: true,
        payment: {
          select: {
            paidAmount: true,
            paidAmountCurrency: true,
          },
        },
      },
    });
    // last subscription related to a payment with the status succeeded or processing
    // OR trial subscription (no payment required)
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        OR: [
          activeSubscriptionWhereInput,
          {
            // Essai gratuit actif
            isTrial: true,
            trialEnd: { gte: new Date() },
          }
        ]
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        ...subscriptionPublicSelectInput,
        // Ajouter les champs d'essai
        isTrial: true,
        trialEnd: true,
        trialStarted: true,
        trialConvertedAt: true,
      },
    });

    return Response.json(
      toSafeJSON<
        IPaginateResponse<{
          subscription: Subscription | null;
          purchases: Array<{
            entityType: PurchaseEntityType;
            entityId: string;
            amount: number;
            currency: Currency;
          }>;
        }>
      >({
        subscription,
        purchases: purchases.map((item) => ({
          entityType: item.entityType,
          entityId: item.postId.toString(),
          amount: item.payment.paidAmount,
          currency: item.payment.paidAmountCurrency,
        })),
      }),
    );
  });
}
