import adminMiddleware from "@/lib/auth/adminMiddleware";
import countryAndExchangeRatesMiddleware from "@/lib/middlewares/countryAndExchangeRatesMiddleware";
import prisma from "@/lib/prisma";
import { createMobileMoneyMyCoolPay } from "@/lib/utils/mycoolpayUtils";
import { createMobileMoneyFrancoPayment } from "@/lib/utils/flutterwaveUtils";
import { syncFlutterwaveCronJob } from "@/lib/flutterwave/syncCronJob";
import {
  convertAmountToClientCurrency,
  roundToNext100,
} from "@/lib/utils/index";
import { Plan } from "@prisma/client";
import { serializeError } from "serialize-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  userId: z.string({
    required_error: "L'ID de l'utilisateur est requis.",
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
  provider: z.enum(["mycoolpay", "flutterwave"], {
    required_error: "Le fournisseur de paiement est requis.",
  }).default("mycoolpay"),
  userIp: z.string().optional(),
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
  return adminMiddleware(request, async (adminUser) => {
    try {
      const body = await request.json();
      const bodyPayload = schema.parse(body);

      // Get the target user
      const targetUser = await prisma.user.findUnique({
        where: { id: bodyPayload.userId },
      });

      if (!targetUser) {
        return Response.json(
          { error: "Utilisateur introuvable" },
          { status: 404 }
        );
      }

      // Get the plan
      const plan = await prisma.plan.findUnique({
        where: { id: bodyPayload.planId },
      });

      if (!plan) {
        return Response.json(
          { error: "Offre introuvable" },
          { status: 404 }
        );
      }

      // Sync Flutterwave cron job if using Flutterwave
      if (bodyPayload.provider === "flutterwave") {
        await syncFlutterwaveCronJob();
      }

      // Use default IP if not provided (for admin forced payments)
      const userIp = bodyPayload.userIp || "41.79.229.1"; // Default Cameroon IP

      return await countryAndExchangeRatesMiddleware(
        userIp,
        "eur",
        async (ipData, exchangeRates) => {
          // For admin forced payments, allow any currency but default to XAF if not supported
          let currencyCode = ipData.currencyCode.toLowerCase();
          if (!["xaf", "xof"].includes(currencyCode)) {
            // Default to XAF for unsupported currencies in admin mode
            currencyCode = "xaf";
            ipData.currencyCode = "XAF";
            ipData.countryAlpha2Code = "CM"; // Cameroon
          }

          const baseAmount = evaluatePlanPrice(plan, bodyPayload.billingPeriod);

          // Convert amount
          const amount = convertAmountToClientCurrency(
            ipData,
            exchangeRates,
            baseAmount,
            plan.amountCurrency,
          );

          // Adjusted amount
          const finalAmount = roundToNext100(amount.amount);

          // Payment metadata for the payment intent
          const paymentMeta = {
            userId: targetUser.id,
            product: "subscription" as const,
            planId: plan.id,
            period: bodyPayload.billingPeriod,
          };
          
          // Additional metadata for admin tracking
          const adminMeta = {
            adminForced: true,
            adminId: adminUser.id,
          };

          // Process the payment using the selected provider
          let result;
          if (bodyPayload.provider === "mycoolpay") {
            result = await createMobileMoneyMyCoolPay(
              ipData,
              targetUser,
              "subscription",
              bodyPayload.phoneNumber,
              {
                currency: amount.currency,
                value: finalAmount,
              },
              paymentMeta,
            );
          } else if (bodyPayload.provider === "flutterwave") {
            result = await createMobileMoneyFrancoPayment(
              ipData,
              targetUser,
              "subscription",
              bodyPayload.phoneNumber,
              {
                currency: amount.currency,
                value: finalAmount,
              },
              paymentMeta,
            );
          } else {
            return Response.json({
              success: false,
              error: {
                message: "Fournisseur de paiement non supporté",
                code: "UNSUPPORTED_PROVIDER"
              },
            }, {
              status: 400,
            });
          }

          if (result.success) {
            return Response.json({
              success: true,
              message: `Paiement initié pour l'utilisateur ${targetUser.name || targetUser.email} via ${bodyPayload.provider === "mycoolpay" ? "MyCoolPay" : "Flutterwave"}`,
              payment: result.data?.payment,
              user: {
                id: targetUser.id,
                name: targetUser.name,
                email: targetUser.email,
              },
              plan: {
                id: plan.id,
                title: plan.title,
                period: bodyPayload.billingPeriod,
              },
              provider: bodyPayload.provider,
            }, {
              status: 201,
            });
          } else {
            return Response.json({
              success: false,
              error: result.error,
            }, {
              status: 400,
            });
          }
        },
      );
    } catch (error) {
      console.error("Error in admin force mobile money payment:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}