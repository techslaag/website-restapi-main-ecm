import IPaymentIntentMetaData from "@/interfaces/IPaymentIntentMetaData";
import authMiddleware from "@/lib/auth/authMiddleware";
import { sendEmail } from "@/lib/mail";
import buildSubscriptionSuccessEmail from "@/lib/mail/emails/buildSubscriptionSuccessEmail";
import prisma from "@/lib/prisma";
import {
  generatePaymentReference,
  generateSubscriptionReference,
} from "@/lib/referenceFactory";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { markAsRecovered } from "@/lib/utils/abandonedSubscriptionTracker";
import { broadcastPaymentUpdate } from "@/lib/websocket/paymentWebSocket";
import { Currency, Plan } from "@prisma/client";
import moment from "moment";
import { serializeError } from "serialize-error";
import { z } from "zod";

/**
 * @swagger
 * /checkout/apple-pay/process-payment/plan/{planId}:
 *   post:
 *     summary: Process Apple Pay payment for a subscription plan
 *     description: This endpoint processes Apple Pay payments and creates the subscription after successful payment
 *     operationId: processApplePaySubscriptionPayment
 *     tags:
 *       - Apple Pay
 *       - Subscription
 *     parameters:
 *       - name: planId
 *         in: path
 *         description: The subscription plan ID
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       description: Payment information including billing period and Apple Pay payment token
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
 *                 description: The billing period for the subscription
 *               paymentToken:
 *                 type: string
 *                 description: The Apple Pay payment token (optional for tracking)
 *               transactionId:
 *                 type: string
 *                 description: The Apple Pay transaction ID (optional for tracking)
 *             required:
 *               - billingPeriod
 *     responses:
 *       '200':
 *         description: Payment processed and subscription created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Payment success status
 *                 subscriptionId:
 *                   type: string
 *                   description: The created subscription ID
 *                 paymentId:
 *                   type: string
 *                   description: The created payment ID
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   description: Subscription expiration date
 *       '400':
 *         description: Invalid request parameters
 *       '404':
 *         description: Plan not found or archived
 *       '500':
 *         description: Internal server error
 */

export const dynamic = "force-dynamic";

const schema = z.object({
  billingPeriod: z.enum(["month", "year"], {
    required_error: "La période de facturation est requise.",
  }),
  paymentToken: z.string().optional(),
  transactionId: z.string().optional(),
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

  return {
    value,
    currency: plan.amountCurrency,
  };
}

export async function POST(
  req: Request,
  { params: { planId } }: { params: { planId: string } },
) {
  return authMiddleware(req, async (user) => {
    try {
      // Load plan
      const plan = await prisma.plan.findUnique({
        where: { id: planId, archivedAt: null },
      });

      // Check if plan exists
      if (!plan) {
        return Response.json(
          { message: "L'offre est introuvable." },
          { status: 404 },
        );
      }

      // Validate request body
      const bodyPayload = schema.parse(await requestJsonBody(req));

      // Evaluate the order price
      const orderAmount = evaluatePlanPrice(plan, bodyPayload.billingPeriod);

      // Generate unique payment reference
      const paymentReference = await generatePaymentReference("subscription");

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          reference: paymentReference,
          userId: user.id,
          externalId: bodyPayload.transactionId || `applepay_${Date.now()}`,
          paidAmountCurrency: orderAmount.currency as Currency,
          receivedCurrency: orderAmount.currency as Currency,
          paidAmount: orderAmount.value,
          receivedAmount: orderAmount.value,
          status: "succeeded",
          provider: "apple_pay",
          providerPaymentMethod: "apple_pay",
          webhookPayloads: JSON.stringify({
            paymentToken: bodyPayload.paymentToken,
            transactionId: bodyPayload.transactionId,
            processedAt: new Date().toISOString(),
          }),
          meta: JSON.stringify({
            userId: user.id,
            product: "subscription",
            planId: plan.id,
            period: bodyPayload.billingPeriod,
          } as IPaymentIntentMetaData),
          updatedAt: new Date(),
          updatedById: user.id,
        },
      });

      // Broadcast payment success
      broadcastPaymentUpdate(payment.id, payment);

      // Calculate expiration date
      const currentDate = moment();
      const expiresAt = (() => {
        switch (bodyPayload.billingPeriod) {
          case "month":
            return currentDate.add(1, "month").toDate();
          case "year":
            return currentDate.add(1, "year").toDate();
        }
      })();

      // Create subscription
      const subscription = await prisma.subscription.create({
        data: {
          reference: await generateSubscriptionReference(),
          planId: plan.id,
          period: bodyPayload.billingPeriod,
          userId: user.id,
          paymentId: payment.id,
          expiresAt: expiresAt,
          updatedAt: new Date(),
          updatedById: user.id,
        },
        include: {
          user: true,
          plan: true,
          payment: true,
        },
      });

      // Mark abandoned subscription as recovered if exists
      try {
        await markAsRecovered(
          null, // sessionId
          user.id,
          plan.id,
          subscription.id
        );
      } catch (trackingError) {
        console.error("Error marking abandoned subscription as recovered:", trackingError);
        // Don't block the payment process
      }

      // Send subscription success email
      try {
        if (user.email) {
          const email = await buildSubscriptionSuccessEmail(subscription);

          await sendEmail(
            {
              to: user.email,
              subject: `Abonnement ${plan.title} activé`,
              html: email.emailHtml,
              text: email.emailText,
            },
            (err, info) => {
              if (err) {
                console.error("Failed to send subscription email:", err);
              }
            }
          );
        }
      } catch (emailError) {
        console.error("Error sending subscription email:", emailError);
        // Don't block the payment process
      }

      // Return success response
      return Response.json({
        success: true,
        subscriptionId: subscription.id,
        paymentId: payment.id,
        expiresAt: expiresAt.toISOString(),
        message: "Paiement traité avec succès et abonnement créé.",
      });
    } catch (error) {
      console.error("Error processing Apple Pay payment:", serializeError(error));
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
