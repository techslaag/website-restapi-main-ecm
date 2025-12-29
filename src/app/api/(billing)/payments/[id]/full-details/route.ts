import IPaymentIntentMetaData from "@/interfaces/IPaymentIntentMetaData";
import { toIPost } from "@/interfaces/IPost";
import { PRODUCT_PUBLIC_SELECT_INPUT, toIProduct } from "@/interfaces/IProduct";
import prisma from "@/lib/prisma";
import { syncTransactionStatus } from "@/lib/utils/flutterwaveUtils";
import { PAYMENT_PUBLIC_SELECT_INPUT } from "@/lib/utils/paymentUtils";
import { POST_SELECT_INPUT } from "@/lib/utils/postUtils";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: paymentId } }: { params: { id: string } },
) {
  try {
    // load the payment
    let payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        ...PAYMENT_PUBLIC_SELECT_INPUT,
        externalId: true,
        meta: true,
      },
    });

    if (payment) {
      /**
       * Flutterwave transaction status verification
       * -------------------------------------------------
       * only if the payment status is processing
       */
      if (
        payment.status === "processing" &&
        payment.provider === "flutterwave"
      ) {
        try {
          // synchronize the status
          await syncTransactionStatus(payment);

          // reload the payment
          const paymentBis = await prisma.payment.findUnique({
            where: { id: paymentId },
            select: {
              ...PAYMENT_PUBLIC_SELECT_INPUT,
              externalId: true,
              meta: true,
            },
          });

          if (paymentBis) {
            payment = paymentBis;
          }
        } catch (error) {
          // send the error to sentry
        }
      }

      const meta = JSON.parse(payment.meta as string) as IPaymentIntentMetaData;

      const item = await (async () => {
        switch (meta.product) {
          case "post": {
            const postData = await prisma.mod180_posts.findUnique({
              where: { ID: Number(meta.postId) },
              select: POST_SELECT_INPUT,
            });

            return postData ? toIPost(postData) : null;
          }

          case "product": {
            const productData = await prisma.mod180_posts.findUnique({
              where: { ID: Number(meta.productId) },
              select: PRODUCT_PUBLIC_SELECT_INPUT,
            });

            return {
              type: meta.entityType,
              data: await toIProduct(productData),
            };
          }

          case "subscription": {
            const planData = await prisma.plan.findUnique({
              where: { id: meta.planId },
            });

            return {
              period: meta.period,
              data: planData,
            };
          }
        }
      })();

      return Response.json({
        productType: meta.product,
        payment,
        item,
      });
    } else {
      return Response.json(
        {
          message: "Paiement introuvable.",
        },
        {
          status: 404,
        },
      );
    }
  } catch (error) {
    return Response.json(serializeError(error), {
      status: 500,
    });
  }
}
