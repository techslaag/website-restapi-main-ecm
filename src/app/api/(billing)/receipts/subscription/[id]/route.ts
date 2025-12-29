import IPaymentReceipt from "@/interfaces/IPaymentReceipt";
import authMiddleware from "@/lib/auth/authMiddleware";
import generatePaymentReceipt from "@/lib/payment-receipt/generatePaymentReceipt";
import prisma from "@/lib/prisma";
import { sanitizeEmail } from "@/lib/utils";
import slugify from "slugify";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: subscriptionId } }: { params: { id: string } },
) {
  return authMiddleware(req, async (user) => {
    // load subscription
    const subscription = await prisma.subscription.findUnique({
      where: {
        id: subscriptionId,
        payment: {
          status: "succeeded",
        },
        userId: user.id,
      },
      include: {
        payment: true,
        user: true,
        plan: true,
      },
    });

    if (subscription && subscription.payment) {
      // create the receipt input
      const receipt: IPaymentReceipt = {
        currency: subscription.payment.paidAmountCurrency,
        receiptNumber: subscription.payment.reference,
        items: [
          {
            amount: subscription.payment.paidAmount.toNumber(),
            description: `Abonnement ${subscription.plan.title} ${(() => {
              switch (subscription.period) {
                case "month":
                  return "(M)";

                case "year":
                  return "(A)";
              }
            })()}`,
            item: subscription.reference,
            quantity: 1,
          },
        ],
        paid: subscription.payment.paidAmount.toNumber(),
        shipping: {
          email: sanitizeEmail(subscription.user.email) ?? "",
          name: subscription.user.name ?? "",
        },
        subtotal: subscription.payment.paidAmount.toNumber(),
        date: subscription.createdAt,
      };

      // generate the receipt
      const receiptBuffer = await generatePaymentReceipt(receipt);

      // generate the file name
      const receiptFileName = slugify(
        `receipt-${subscription.plan.title}-${subscription.payment.reference.replaceAll(".", "-")}.pdf`.toLowerCase(),
      );

      return new Response(new Uint8Array(receiptBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=${receiptFileName}`,
        },
      });
    } else {
      return Response.json({ message: "Facture introuvable" }, { status: 404 });
    }
  });
}
