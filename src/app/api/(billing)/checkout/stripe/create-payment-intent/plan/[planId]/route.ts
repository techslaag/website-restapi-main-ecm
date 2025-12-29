import IPaymentIntentMetaData from "@/interfaces/IPaymentIntentMetaData";
import authMiddleware from "@/lib/auth/authMiddleware";
import prisma from "@/lib/prisma";
import stripe, { formatStripeAmountOut } from "@/lib/stripe/stripe";
import { syncStripeWebhooks } from "@/lib/stripe/stripeWebhookSync";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { trackAbandonedSubscription, extractTrackingInfo } from "@/lib/utils/abandonedSubscriptionTracker";
import { Plan } from "@prisma/client";
import { serializeError } from "serialize-error";
import { z } from "zod";

/**
 * @swagger
 * /subscription/{planId}:
 *   post:
 *     summary: Créer un PaymentIntent pour un abonnement
 *     description: Cette route permet de créer un PaymentIntent pour souscrire à un plan d'abonnement avec Stripe en fonction de la période de facturation choisie (mensuelle ou annuelle).
 *     operationId: createPaymentIntentForSubscription
 *     tags:
 *       - Abonnement
 *     parameters:
 *       - name: planId
 *         in: path
 *         description: L'ID du plan d'abonnement.
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       description: Les informations nécessaires pour créer le paiement (période de facturation).
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               billingPeriod:
 *                 type: string
 *                 enum:
 *                   - month
 *                   - year
 *                 description: La période de facturation de l'abonnement.
 *             required:
 *               - billingPeriod
 *     responses:
 *       '200':
 *         description: PaymentIntent créé avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 amount:
 *                   type: number
 *                   description: Montant de l'abonnement à payer.
 *                 clientSecret:
 *                   type: string
 *                   description: Client secret pour finaliser le paiement via Stripe.
 *                 currency:
 *                   type: string
 *                   description: Devise utilisée pour le paiement (en fonction de la devise du plan).
 *       '400':
 *         description: Erreur de validation des paramètres (par exemple, la période de facturation n'a pas été fournie).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Détail de l'erreur.
 *       '404':
 *         description: Le plan spécifié est introuvable ou archivé.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Détail de l'erreur ("L'offre est introuvable").
 *       '500':
 *         description: Une erreur interne s'est produite lors du traitement de la requête.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Message détaillant l'erreur interne.
 */


export const dynamic = "force-dynamic";

const schema = z.object({
  billingPeriod: z.enum(["month", "year"], {
    required_error: "La période de facturation est requise.",
  }),
});

function evaluatePlanPrice(plan: Plan, period: "month" | "year") {
  let value: number;
  let finalAmount: number;

  switch (period) {
    case "month":
      value = plan.monthlyPrice.toNumber();
      break;

    case "year":
      value = plan.yearlyPrice.toNumber();
      break;
  }

  finalAmount = formatStripeAmountOut(value, plan.amountCurrency);

  return {
    value,
    finalAmount,
  };
}

export async function POST(
  req: Request,
  { params: { planId } }: { params: { planId: string } },
) {
  return authMiddleware(req, async (user) => {
    /**
     * Important: Sync stripe webhooks
     * ----------------------------------
     */
    syncStripeWebhooks();

    try {
      // load plan
      const plan = await prisma.plan.findUnique({
        where: { id: planId, archivedAt: null },
      });

      // plan exists
      if (plan) {
        // validate the body
        const bodyPayload = schema.parse(await requestJsonBody(req));

        // Track abandoned subscription - payment method step
        try {
          const trackingInfo = extractTrackingInfo(req as any);
          await trackAbandonedSubscription({
            sessionId: req.headers.get('x-session-id') || undefined,
            userId: user.id,
            planId: plan.id,
            period: bodyPayload.billingPeriod,
            email: user.email || undefined,
            step: 'payment_method',
            ...trackingInfo,
            metadata: {
              action: 'create_payment_intent',
              planTitle: plan.title,
              amount: evaluatePlanPrice(plan, bodyPayload.billingPeriod).value
            }
          });
        } catch (trackingError) {
          console.error('Error tracking abandoned subscription:', trackingError);
          // Ne pas bloquer le processus de paiement
        }

        // evaluate the order price
        const orderAmount = evaluatePlanPrice(plan, bodyPayload.billingPeriod);

        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
          amount: orderAmount.finalAmount,
          currency: plan.amountCurrency.toLowerCase(),
          // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
          automatic_payment_methods: {
            enabled: true,
          },
          metadata: {
            userId: user.id,
            product: "subscription",
            planId: plan.id,
            period: bodyPayload.billingPeriod,
          } as IPaymentIntentMetaData,
        });

        return Response.json({
          amount: orderAmount.value,
          clientSecret: paymentIntent.client_secret,
          currency: plan.amountCurrency,
        });
      } else {
        return Response.json(
          { message: "L'offre est introuvable." },
          { status: 404 },
        );
      }
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
