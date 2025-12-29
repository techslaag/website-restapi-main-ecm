import IProduct, {
  PRODUCT_PUBLIC_SELECT_INPUT,
  toIProduct,
} from "@/interfaces/IProduct";
import authMiddleware from "@/lib/auth/authMiddleware";
import countryAndExchangeRatesMiddleware from "@/lib/middlewares/countryAndExchangeRatesMiddleware";
import prisma from "@/lib/prisma";
import { createMobileMoneyMyCoolPay } from "@/lib/utils/mycoolpayUtils";
import {
  convertAmountToClientCurrency,
  requestJsonBody,
  roundToNext100,
} from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  userIp: z.string({
    required_error: "L'adresse ip de l'utilisateur est requise.",
  }),
  productId: z.string({
    required_error: "L'identifiant du produit obligatoire.",
  }),
  phoneNumber: z.string({
    required_error: "Le numéro de téléphone est obligatoire.",
  }),
});

function evaluateProductPrice(product: IProduct) {
  // the product must have a price
  let value: number = Number(product.price ?? 0);
  return {
    value,
    currency: product.currency ?? "EUR",
  };
}

export async function POST(request: Request) {
  return authMiddleware(request, async (user) => {
    try {
      // validate the body
      const bodyPayload = schema.parse(await requestJsonBody(request));

      return await countryAndExchangeRatesMiddleware(
        bodyPayload.userIp,
        "eur",
        async (ipData, exchangeRates) => {
          // check if user already owns the product
          const purchase = await prisma.purchase.findFirst({
            where: {
              userId: user.id,
              postId: Number(bodyPayload.productId),
              payment: { status: "succeeded" },
            },
          });

          if (purchase) {
            return Response.json(
              {
                message:
                  "Vous avez déjà acheté ce produit. Merci de consulter vos achats.",
              },
              {
                status: 400,
              },
            );
          }

          // check supported currency (XAF/XOF for MyCoolPay)
          if (["xaf", "xof"].includes(ipData.currencyCode.toLowerCase())) {
            // fetch the product
            const productData = await prisma.mod180_posts.findUnique({
              where: { ID: Number(bodyPayload.productId) },
              select: PRODUCT_PUBLIC_SELECT_INPUT,
            });

            // product exists
            if (productData) {
              // convert to structured product
              const product = await toIProduct(productData);

              const baseAmount = evaluateProductPrice(product);

              // converted amount from EUR to local currency (XAF/XOF)
              const amount = convertAmountToClientCurrency(
                ipData,
                exchangeRates,
                baseAmount.value,
                baseAmount.currency,
              );

              // adjusted amount (round to next 100 for mobile money)
              const finalAmount = roundToNext100(amount.amount);

              // process the payment via MyCoolPay
              const result = await createMobileMoneyMyCoolPay(
                ipData,
                user,
                "product",
                bodyPayload.phoneNumber,
                {
                  currency: amount.currency,
                  value: finalAmount,
                },
                {
                  userId: user.id,
                  product: "product",
                  entityType: (() => {
                    switch (product.productType) {
                      case "bihebdomadaire":
                        return "biweekly";

                      case "hors-serie":
                        return "special_issues";

                      case "magazine":
                        return "magazine";
                    }
                  })(),
                  productId: `${product.id}`,
                },
              );

              if (result.success) {
                return Response.json(result.data?.payment, {
                  status: 201,
                });
              } else {
                return Response.json(result.error, {
                  status: 400,
                });
              }
            } else {
              return Response.json(
                { message: "Le produit est introuvable." },
                { status: 400 },
              );
            }
          } else {
            return Response.json(
              {
                message:
                  "Ce mode de paiement n'est pas supporté dans votre pays. Utilisez une carte bancaire.",
              },
              { status: 400 },
            );
          }
        },
      );
    } catch (error) {
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}