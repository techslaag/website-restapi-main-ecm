import authMiddleware from "@/lib/auth/authMiddleware";
import countryAndExchangeRatesMiddleware from "@/lib/middlewares/countryAndExchangeRatesMiddleware";
import { serializeError } from "serialize-error";
import { z } from "zod";
import prisma from "@/lib/prisma";
// import { convertAmountToClientCurrency, roundToNext100 } from "@/lib/utils/priceUtils";
import { createMobileMoneyMyCoolPay } from "@/lib/utils/mycoolpayUtils";
import { Plan } from "@prisma/client";
import {
  convertAmountToClientCurrency,
  requestJsonBody,
  roundToNext100,
} from "@/lib/utils/index";

const schema = z.object({
  planId: z.string(),
  billingPeriod: z.enum(["month", "year"]),
  phoneNumber: z.string().min(8),
  userIp: z.string(),
});

function evaluatePlanPrice(plan: Plan, period: "month" | "year") {
  let value: number;

  switch (period) {
    case "month":
      value = plan.monthlyPrice.toNumber();
      break;

    case "year":
      value = plan.yearlyPrice.toNumber();
      break;
  }

  return value;
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
            // Vérification de la disponibilité géographique
            if (!["xaf", "xof"].includes(ipData.currencyCode.toLowerCase())) {
              console.log("[MyCoolPay Route] Country not supported:", ipData.currencyCode);
              return Response.json(
                { 
                  message: "Ce mode de paiement n'est pas disponible dans votre pays.", 
                  code: "COUNTRY_NOT_SUPPORTED",
                  supportedCountries: ["Cameroun", "Côte d'Ivoire", "Sénégal", "Mali", "Burkina Faso", "Bénin", "Togo", "Niger"]
                },
                { status: 400 }
              );
            }

            // Vérification du plan
            const plan = await prisma.plan.findUnique({
              where: { id: bodyPayload.planId },
            });

            if (!plan) {
              console.log("[MyCoolPay Route] Plan not found:", bodyPayload.planId);
              return Response.json(
                { 
                  message: "L'offre sélectionnée n'existe plus ou n'est plus disponible.", 
                  code: "PLAN_NOT_FOUND" 
                },
                { status: 404 }
              );
            }

            // Calcul du montant
            const baseAmount = evaluatePlanPrice(plan, bodyPayload.billingPeriod);
            const amount = convertAmountToClientCurrency(
              ipData,
              exchangeRates,
              baseAmount,
              plan.amountCurrency,
            );
            const finalAmount = roundToNext100(amount.amount);

            console.log("[MyCoolPay Route] Processing payment:", {
              plan: plan.title,
              amount: finalAmount,
              currency: 'XAF',
              phone: bodyPayload.phoneNumber,
              country: ipData.countryAlpha2Code
            });

            // Appel de l'API MyCoolPay
            const result = await createMobileMoneyMyCoolPay(
              ipData,
              user,
              "subscription",
              bodyPayload.phoneNumber,
              {
                currency: 'XAF',
                value: finalAmount,
              },
              {
                userId: user.id,
                product: "subscription",
                planId: plan.id,
                period: bodyPayload.billingPeriod,
              },
            );

            if (result.success) {
              console.log("[MyCoolPay Route] Payment created successfully:", result.data?.payment?.reference);
              return Response.json(result.data?.payment, { status: 201 });
            } else {
              console.log("[MyCoolPay Route] Payment failed:", result.error);
              
              // Retourner l'erreur avec un statut approprié (pas 500)
              const statusCode = result.error?.code === "EXISTING_PAYMENT" ? 409 : 400;
              return Response.json(result.error, { status: statusCode });
            }
          } catch (middlewareError) {
            console.error("[MyCoolPay Route] Middleware error:", middlewareError);
            
            // Gestion d'erreur plus spécifique
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
      console.error("[MyCoolPay Route] Global error:", error);
      
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
