import authMiddleware from "@/lib/auth/authMiddleware";
import { syncFlutterwaveCronJob } from "@/lib/flutterwave/syncCronJob";
import countryAndExchangeRatesMiddleware from "@/lib/middlewares/countryAndExchangeRatesMiddleware";
import prisma from "@/lib/prisma";
import { createMobileMoneyFrancoPayment } from "@/lib/utils/flutterwaveUtils";
import {
  convertAmountToClientCurrency,
  requestJsonBody,
  roundToNext100,
} from "@/lib/utils/index";
import { Plan } from "@prisma/client";
import { serializeError } from "serialize-error";
import { z } from "zod";

/**
 * @swagger
 * /post/payment:
 *   post:
 *     summary: Créer un paiement pour un abonnement via Mobile Money
 *     description: Cette route permet à un utilisateur de créer un paiement pour un abonnement en fonction du plan et de la période de facturation choisis.
 *     operationId: postPaymentSubscription
 *     tags:
 *       - MobileMoney
 *     requestBody:
 *       description: Données nécessaires pour créer un paiement d'abonnement.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userIp:
 *                 type: string
 *                 description: L'adresse IP de l'utilisateur.
 *               planId:
 *                 type: string
 *                 description: L'ID du plan choisi pour l'abonnement.
 *               billingPeriod:
 *                 type: string
 *                 enum: [month, year]
 *                 description: La période de facturation de l'abonnement (mensuelle ou annuelle).
 *               phoneNumber:
 *                 type: string
 *                 description: Le numéro de téléphone pour le paiement via Mobile Money.
 *             required:
 *               - userIp
 *               - planId
 *               - billingPeriod
 *               - phoneNumber
 *     responses:
 *       '201':
 *         description: Le paiement a été traité avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 payment:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       description: Le statut du paiement.
 *                     transactionId:
 *                       type: string
 *                       description: Identifiant unique de la transaction.
 *       '400':
 *         description: La requête contient des erreurs, par exemple un plan introuvable ou un problème de support de devise.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message détaillant l'erreur (ex. "Offre introuvable" ou "Mode de paiement non supporté").
 *       '500':
 *         description: Erreur interne du serveur.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message d'erreur détaillé.
 */

export const dynamic = "force-dynamic";

const schema = z.object({
  userIp: z.string({
    required_error: "L'adresse ip de l'utilisateur est requise.",
  }),
  planId: z.string({
    required_error: "L'offre est obligatoire.",
  }),
  billingPeriod: z.enum(["month", "year"], {
    required_error: "La période de facturation est requise.",
  }),
  phoneNumber: z.string({
    required_error: "Le numéro de téléphone est obligatoire.",
  }),
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
      /**
       * Sync cron job url
       * ----------------------------
       */
      await syncFlutterwaveCronJob();

      // validate the body
      const bodyPayload = schema.parse(await requestJsonBody(request));

      return await countryAndExchangeRatesMiddleware(
        bodyPayload.userIp,
        "eur",
        async (ipData, exchangeRates) => {
          // check supported currency
          if (["xaf", "xof"].includes(ipData.currencyCode.toLowerCase())) {
            // fetch the plan
            const plan = await prisma.plan.findUnique({
              where: { id: bodyPayload.planId },
            });

            // plan exists
            if (plan) {
              const baseAmount = evaluatePlanPrice(
                plan,
                bodyPayload.billingPeriod,
              );

              // converted amount
              const amount = convertAmountToClientCurrency(
                ipData,
                exchangeRates,
                baseAmount,
                plan.amountCurrency,
              );

              // adjusted amount
              const finalAmount = roundToNext100(amount.amount);

              // process the payment
              const result = await createMobileMoneyFrancoPayment(
                ipData,
                user,
                "subscription",
                bodyPayload.phoneNumber,
                {
                  currency: amount.currency,
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
                { message: "L'offre est introuvable." },
                { status: 400 },
              );
            }
          } else {
            return Response.json(
              {
                message:
                  "Ce mode de paiement n'est pas supporté dans votre pays.",
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
