import IPaymentReceipt from "@/interfaces/IPaymentReceipt";
import authMiddleware from "@/lib/auth/authMiddleware";
import generatePaymentReceipt from "@/lib/payment-receipt/generatePaymentReceipt";
import prisma from "@/lib/prisma";
import { sanitizeEmail } from "@/lib/utils";
import { fetchPurchaseRelatedProduct } from "@/lib/utils/purchaseUtils";
import slugify from "slugify";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: purchaseId } }: { params: { id: string } },
) {
  return authMiddleware(req, async (user) => {
    // load purchase
    const purchase = await prisma.purchase.findUnique({
      where: {
        id: purchaseId,
        payment: {
          status: "succeeded",
        },
        userId: user.id,
      },
      include: {
        payment: true,
        user: true,
      },
    });

    if (purchase) {
      const productData = await fetchPurchaseRelatedProduct(
        purchase.entityType,
        purchase.postId.toString(),
      );
      // create the receipt input
      const receipt: IPaymentReceipt = {
        currency: purchase.payment.paidAmountCurrency,
        receiptNumber: purchase.payment.reference,
        items: [
          {
            amount: purchase.payment.paidAmount.toNumber(),
            description: productData.data
              ? `${productData.data.title}`
              : productData.details.label,
            item: purchase.payment.reference,
            quantity: 1,
          },
        ],
        paid: purchase.payment.paidAmount.toNumber(),
        shipping: {
          email: sanitizeEmail(purchase.user.email) ?? "",
          name: purchase.user.name ?? "",
        },
        subtotal: purchase.payment.paidAmount.toNumber(),
        date: purchase.createdAt,
      };

      // generate the receipt
      const receiptBuffer = await generatePaymentReceipt(receipt);

      // generate the file name
      const receiptFileName = slugify(
        `receipt-${purchase.entityType}-${purchase.payment.reference.replaceAll(".", "-")}.pdf`.toLowerCase(),
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
