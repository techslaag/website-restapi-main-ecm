import IFlutterwaveFrMobileMoney from "@/interfaces/IFlutterwaveFrMobileMoney";
import IPaymentIntentMetaData from "@/interfaces/IPaymentIntentMetaData";
import prisma from "@/lib/prisma";
import {
  Currency,
  IpLookupBackup,
  Payment,
  Prisma,
  User,
} from "@prisma/client";
import { parsePhoneNumber } from "libphonenumber-js";
import { sanitizeEmail } from ".";
import { detectOperator } from "../operatorNumberPrefix";
import { generatePaymentReference } from "../referenceFactory";
import {
  PAYMENT_PUBLIC_SELECT_INPUT,
  applyPaymentResult,
} from "./paymentUtils";
import IFlutterwaveVerificationResponse from "@/interfaces/IFlutterwaveVerificationResponse";

export async function createMobileMoneyFrancoPayment(
  countryData: IpLookupBackup,
  user: User,
  productType: "subscription" | "post" | "product" | "packageFw" | "documentaire",
  phoneNumber: string,
  amount: {
    value: number;
    currency: string;
  },
  meta: IPaymentIntentMetaData,
) {
  const count = await prisma.payment.count({
    where: {
      provider: "flutterwave",
      userId: user.id,
      status: "processing",
    },
  });

  // no ongoing payment
  if (count === 0) {
    // generate payment reference
    const paymentReference = await generatePaymentReference(productType);

    // create flutterwave francophone mobile money
    const paymentData: IFlutterwaveFrMobileMoney = await fetch(
      `${process.env.FLUTTERWAVE_API_URL}/v3/charges?type=mobile_money_franco`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          amount: amount.value,
          currency: amount.currency.toUpperCase(),
          email: sanitizeEmail(user.email),
          tx_ref: paymentReference,
        }),
      },
    ).then(async (res) => {
      if (res.ok) {
        return await res.json();
      } else {
        const errorText = await res.text();
        try {
          throw JSON.parse(errorText);
        } catch (error) {
          throw errorText;
        }
      }
    });

    // parse phone number
    const parsedPhoneNumber = parsePhoneNumber(phoneNumber);

    // create the payment locally
    const result = await prisma.$transaction(async (trx) => {
      // create the payment
      const payment = await trx.payment.create({
        data: {
          clientCountryAlpha2Code: countryData.countryAlpha2Code.toLowerCase(),
          provider: "flutterwave",
          providerPaymentMethod: "mobile_money_franco",
          mobileOperator: detectOperator(
            parsedPhoneNumber.nationalNumber.toString(),
            countryData.countryAlpha2Code,
          ),
          reference: paymentReference,
          userId: user.id,
          externalId: `${paymentData.data.id}`,
          paidAmount: amount.value,
          paidAmountCurrency: amount.currency.toLowerCase() as Currency,
          receivedAmount: Number(
            Number(paymentData.data.amount) - Number(paymentData.data.app_fee),
          ),
          receivedCurrency: paymentData.data.currency.toLowerCase() as Currency,
          meta: JSON.stringify(meta),
          status: (() => {
            switch (paymentData.data.status) {
              case "pending":
                return "processing";

              case "successful":
                return "succeeded";
              default:
                return "failed";
            }
          })(),
          updatedAt: new Date(),
          updatedById: user.id,
        },
        select: PAYMENT_PUBLIC_SELECT_INPUT,
      });

      return {
        payment,
      };
    });

    return {
      success: true,
      data: result,
    };
  } else {
    return {
      success: false,
      error: {
        message: "Vous avez déjà un paiement en cours",
      },
    };
  }
}

export async function syncTransactionStatus(
  payment: Pick<Payment, "id" | "externalId" | "status">,
  testStatus?: Payment["status"],
) {
  // only for processing payment
  if (payment.status === "processing") {
    // get transaction response
    const response = await fetch(
      `${process.env.FLUTTERWAVE_API_URL}/v3/transactions/${payment.externalId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        cache: "no-cache",
      },
    ).then(async (res) => {
      if (res.ok) {
        return (await res.json()) as IFlutterwaveVerificationResponse;
      } else {
        const text = await res.text();
        try {
          throw JSON.parse(text);
        } catch (error) {
          throw text;
        }
      }
    });

    // update payment locally
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status:
          process.env.NODE_ENV === "production"
            ? (() => {
                switch (response.data.status) {
                  case "pending":
                    return "processing";

                  case "successful":
                    return "succeeded";
                  default:
                    return "failed";
                }
              })()
            : testStatus ?? "failed",
        updatedAt: new Date(),
      },
      include: {
        user: true,
      },
    });

    // apply payment result
    await applyPaymentResult(updatedPayment);
  }
}

/**
 * Enhanced verification function for retry system
 * Verify a Flutterwave transaction status for retry purposes
 */
export interface FlutterwaveVerificationResult {
  status: 'successful' | 'failed' | 'pending';
  message?: string;
  amount?: number;
  currency?: string;
  reference?: string;
}

export async function verifyFlutterwaveTransaction(transactionId: string): Promise<FlutterwaveVerificationResult | null> {
  try {
    const response = await fetch(
      `${process.env.FLUTTERWAVE_API_URL}/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        cache: "no-cache",
      },
    );

    if (!response.ok) {
      console.error(`Flutterwave API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as IFlutterwaveVerificationResponse;

    if (data && data.status === 'success' && data.data) {
      return {
        status: data.data.status === 'successful' ? 'successful' : 
                data.data.status === 'failed' ? 'failed' : 'pending',
        message: data.data.processor_response || data.data.gateway_response,
        amount: Number(data.data.amount),
        currency: data.data.currency,
        reference: data.data.tx_ref
      };
    }

    return null;
  } catch (error) {
    console.error('Error verifying Flutterwave transaction:', error);
    return null;
  }
}
