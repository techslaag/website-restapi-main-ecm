import authMiddleware from "@/lib/auth/authMiddleware";
import countryAndExchangeRatesMiddleware from "@/lib/middlewares/countryAndExchangeRatesMiddleware";
import { serializeError } from "serialize-error";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createMobileMoneyMyCoolPay } from "@/lib/utils/mycoolpayUtils";
import IProduct, {
  PRODUCT_PUBLIC_SELECT_INPUT,
  toIProduct,
} from "@/interfaces/IProduct";
import {
  convertAmountToClientCurrency,
  requestJsonBody,
  roundToNext100,
} from "@/lib/utils/index";

export const dynamic = "force-dynamic";

const schema = z.object({
  productId: z.string(),
  phoneNumber: z.string().min(8),
  userIp: z.string(),
});

function evaluateProductPrice(product: IProduct) {
  const value: number = Number(product.price ?? 0);
  return {
    value,
    currency: product.currency ?? "EUR",
  };
}

export async function POST(request: Request) {
  return authMiddleware(request, async (user) => {
    try {
      const bodyPayload = schema.parse(await requestJsonBody(request));

      return await countryAndExchangeRatesMiddleware(
        bodyPayload.userIp,
        "eur",
        async (ipData, exchangeRates) => {
          try {
            // Vérification de la disponibilité géographique (XAF/XOF uniquement pour MyCoolPay)
            if (!["xaf", "xof"].includes(ipData.currencyCode.toLowerCase())) {
              console.log("[MyCoolPay Product] Country not supported:", ipData.currencyCode);
              return Response.json(
                { 
                  message: "Ce mode de paiement n'est pas disponible dans votre pays. Utilisez une carte bancaire.", 
                  code: "COUNTRY_NOT_SUPPORTED",
                  supportedCountries: ["Cameroun", "Côte d'Ivoire", "Sénégal", "Mali", "Burkina Faso", "Bénin", "Togo", "Niger"]
                },
                { status: 400 }
              );
            }

            // Vérification si l'utilisateur possède déjà le produit
            const existingPurchase = await prisma.purchase.findFirst({
              where: {
                userId: user.id,
                postId: Number(bodyPayload.productId),
                payment: { status: "succeeded" },
              },
            });

            if (existingPurchase) {
              console.log("[MyCoolPay Product] Product already owned:", bodyPayload.productId);
              return Response.json(
                {
                  message: "Vous possédez déjà ce produit. Consultez votre bibliothèque.",
                  code: "PRODUCT_ALREADY_OWNED"
                },
                { status: 409 }
              );
            }

            // Récupération du produit
            const productData = await prisma.mod180_posts.findUnique({
              where: { ID: Number(bodyPayload.productId) },
              select: PRODUCT_PUBLIC_SELECT_INPUT,
            });

            if (!productData) {
              console.log("[MyCoolPay Product] Product not found:", bodyPayload.productId);
              return Response.json(
                { 
                  message: "Le produit sélectionné n'existe plus ou n'est plus disponible.", 
                  code: "PRODUCT_NOT_FOUND" 
                },
                { status: 404 }
              );
            }

            // Conversion en objet produit structuré
            const product = await toIProduct(productData);

            // Calcul du montant
            const baseAmount = evaluateProductPrice(product);
            const amount = convertAmountToClientCurrency(
              ipData,
              exchangeRates,
              baseAmount.value,
              baseAmount.currency,
            );
            const finalAmount = roundToNext100(amount.amount);

            console.log("[MyCoolPay Product] Processing payment:", {
              product: product.name,
              productId: product.id,
              amount: finalAmount,
              currency: amount.currency,
              phone: bodyPayload.phoneNumber,
              country: ipData.countryAlpha2Code,
              productType: product.productType
            });

            // Appel de l'API MyCoolPay
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
              console.log("[MyCoolPay Product] Payment created successfully:", result.data?.payment?.reference);
              return Response.json(result.data?.payment, { status: 201 });
            } else {
              console.log("[MyCoolPay Product] Payment failed:", result.error);
              
              // Retourner l'erreur avec un statut approprié
              const statusCode = result.error?.code === "EXISTING_PAYMENT" ? 409 : 400;
              return Response.json(result.error, { status: statusCode });
            }
          } catch (middlewareError) {
            console.error("[MyCoolPay Product] Middleware error:", middlewareError);
            
            // Gestion d'erreur spécifique
            if (middlewareError instanceof Error) {
              if (middlewareError.message.includes("phone")) {
                return Response.json(
                  { 
                    message: "Numéro de téléphone invalide. Vérifiez le format et réessayez.", 
                    code: "INVALID_PHONE_NUMBER" 
                  },
                  { status: 400 }
                );
              } else if (middlewareError.message.includes("currency") || middlewareError.message.includes("exchange")) {
                return Response.json(
                  { 
                    message: "Erreur de conversion de devise. Veuillez réessayer dans quelques minutes.", 
                    code: "CURRENCY_CONVERSION_ERROR" 
                  },
                  { status: 503 }
                );
              }
            }

            return Response.json(
              { 
                message: "Erreur temporaire lors du traitement de votre paiement. Veuillez réessayer dans quelques instants.", 
                code: "TEMPORARY_ERROR" 
              },
              { status: 503 }
            );
          }
        }
      );
    } catch (error: any) {
      console.error("[MyCoolPay Product] Global error:", error);
      
      // Gestion d'erreurs de validation Zod
      if (error?.name === "ZodError") {
        const fieldErrors = error.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        return Response.json(
          { 
            message: `Données invalides: ${fieldErrors}`, 
            code: "VALIDATION_ERROR" 
          },
          { status: 400 }
        );
      }

      // Gestion d'erreurs de base de données
      if (error?.code === "P2002") {
        return Response.json(
          { 
            message: "Une erreur de contrainte de données s'est produite. Veuillez réessayer.", 
            code: "DATABASE_CONSTRAINT_ERROR" 
          },
          { status: 409 }
        );
      }

      if (error?.code?.startsWith("P")) {
        return Response.json(
          { 
            message: "Erreur temporaire de la base de données. Veuillez réessayer dans quelques instants.", 
            code: "DATABASE_ERROR" 
          },
          { status: 503 }
        );
      }

      // Gestion d'erreurs réseau
      if (error?.code === "ENOTFOUND" || error?.code === "ECONNREFUSED") {
        return Response.json(
          { 
            message: "Service temporairement indisponible. Veuillez réessayer dans quelques minutes.", 
            code: "SERVICE_UNAVAILABLE" 
          },
          { status: 503 }
        );
      }

      // Erreur générique avec message utilisateur
      return Response.json(
        { 
          message: "Une erreur inattendue s'est produite. Si le problème persiste, contactez notre support.", 
          code: "INTERNAL_ERROR" 
        },
        { status: 500 }
      );
    }
  });
}