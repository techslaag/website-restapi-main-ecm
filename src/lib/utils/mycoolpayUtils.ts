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


export async function createMobileMoneyMyCoolPay(
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
      provider: "mycoolpay",
      userId: user.id,
      status: "processing",
    },
  });

  if (count === 0) {
    const paymentReference = await generatePaymentReference(productType);

    // Appel à l'API MyCool Pay
    let paymentData;
    try {
      console.log("[MyCoolPay] Calling API with:", {
        url: `${process.env.MYCOOLPAY_API_URL}/${process.env.MYCOOLPAY_PUBLIC_KEY}/payin`,
        phoneNumber: phoneNumber,
        amount: amount.value,
        currency: amount.currency,
        reference: paymentReference
      });

      const response = await fetch(`${process.env.MYCOOLPAY_API_URL}/${process.env.MYCOOLPAY_PUBLIC_KEY}/payin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MYCOOLPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          customer_phone_number: phoneNumber,
          transaction_amount: amount.value,
          transaction_currency: amount.currency.toUpperCase(),
          app_transaction_ref: paymentReference,
          customer_email: sanitizeEmail(user.email),
          transaction_reason: `Abonnement Ecomatin`,
        }),
      });

      console.log("[MyCoolPay] API Response status:", response.status, response.statusText);

      if (response.ok) {
        paymentData = await response.json();
        console.log("[MyCoolPay] API Success:", paymentData);
      } else {
        const errorText = await response.text();
        console.error("[MyCoolPay] API Error:", response.status, errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          errorData = { message: errorText || `Erreur API MyCoolPay (${response.status})` };
        }

        // Améliorer les messages d'erreur selon le status
        if (response.status === 400) {
          return {
            success: false,
            error: {
              message: errorData.message || "Données de paiement invalides. Vérifiez votre numéro de téléphone et réessayez.",
              code: "INVALID_PAYMENT_DATA"
            }
          };
        } else if (response.status === 401) {
          return {
            success: false,
            error: {
              message: "Erreur d'authentification avec le service de paiement. Contactez le support.",
              code: "PAYMENT_AUTH_ERROR"
            }
          };
        } else if (response.status === 403) {
          return {
            success: false,
            error: {
              message: "Paiement refusé. Vérifiez votre solde ou contactez votre opérateur.",
              code: "PAYMENT_FORBIDDEN"
            }
          };
        } else if (response.status === 429) {
          return {
            success: false,
            error: {
              message: "Trop de tentatives de paiement. Veuillez attendre quelques minutes avant de réessayer.",
              code: "TOO_MANY_REQUESTS"
            }
          };
        } else if (response.status >= 500) {
          return {
            success: false,
            error: {
              message: "Service de paiement temporairement indisponible. Veuillez réessayer dans quelques minutes.",
              code: "PAYMENT_SERVICE_ERROR"
            }
          };
        } else {
          return {
            success: false,
            error: {
              message: errorData.message || `Erreur de paiement inattendue (${response.status}). Contactez le support si le problème persiste.`,
              code: "UNKNOWN_PAYMENT_ERROR"
            }
          };
        }
      }
    } catch (networkError) {
      console.error("[MyCoolPay] Network error:", networkError);
      return {
        success: false,
        error: {
          message: "Impossible de contacter le service de paiement. Vérifiez votre connexion internet et réessayez.",
          code: "NETWORK_ERROR"
        }
      };
    }

    const parsedPhoneNumber = parsePhoneNumber(phoneNumber);

    const result = await prisma.$transaction(async (trx) => {
      const payment = await trx.payment.create({
        data: {
          clientCountryAlpha2Code: countryData.countryAlpha2Code.toLowerCase(),
          provider: "mycoolpay",
          providerPaymentMethod: "mobile_money_mycoolpay",
          mobileOperator: detectOperator(
            parsedPhoneNumber.nationalNumber.toString(),
            countryData.countryAlpha2Code,
          ),
          reference: paymentReference,
          userId: user.id,
          externalId: `${paymentData.transaction_ref}`, // ou `id`, selon la structure de leur réponse
          paidAmount: amount.value,
          paidAmountCurrency: amount.currency.toLowerCase() as Currency,
          receivedAmount: amount.value, // À adapter si leur réponse contient les frais
          receivedCurrency: amount.currency.toLowerCase() as Currency,
          meta: JSON.stringify(meta),
          status: "processing",
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
        message: "Vous avez déjà un paiement en cours. Veuillez attendre quelques minutes avant de réessayer ou vérifiez l'état de votre paiement précédent.",
        code: "EXISTING_PAYMENT",
      },
    };
  }
}

/**
 * Enhanced verification function for retry system
 * Check MyCoolPay transaction status for retry purposes
 */
export interface MyCoolPayStatusResult {
  status: 'SUCCESS' | 'FAILED' | 'CANCELED' | 'PENDING';
  message?: string;
  amount?: number;
  currency?: string;
  reference?: string;
}

export async function checkMyCoolPayTransactionStatus(appTransactionRef: string): Promise<MyCoolPayStatusResult | null> {
  try {
    // MyCoolPay typically provides a status check endpoint
    // This might be a GET request to check status by reference
    const response = await fetch(
      `${process.env.MYCOOLPAY_API_URL}/${process.env.MYCOOLPAY_PUBLIC_KEY}/transaction/${appTransactionRef}/status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.MYCOOLPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
      }
    );

    if (!response.ok) {
      console.error(`MyCoolPay API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (data) {
      return {
        status: data.transaction_status || data.status || 'PENDING',
        message: data.message || data.transaction_message,
        amount: data.transaction_amount || data.amount,
        currency: data.transaction_currency || data.currency,
        reference: data.app_transaction_ref || data.reference
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking MyCoolPay transaction status:', error);
    return null;
  }
}
