import prisma from "@/lib/prisma";
import { Payment, Prisma, Subscription, User } from "@prisma/client";
import moment from "moment";
import { PAYMENT_PUBLIC_SELECT_INPUT } from "./paymentUtils";

export const activeSubscriptionWhereInput: Prisma.SubscriptionWhereInput = {
  expiresAt: {
    gte: new Date(),
  },
  OR: [
    {
      payment: {
        status: { in: ["succeeded", "processing"] },
      },
    },
    {
      paymentId: null,
    },
    {
      // Essai gratuit actif
      isTrial: true,
      trialEnd: { gte: new Date() },
    },
  ],
};

export const subscriptionPublicSelectInput = {
  id: true,
  reference: true,
  period: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  plan: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      updatedById: true,
      planType: true,
      title: true,
      description: true,
      amountCurrency: true,
      digitalBiweeklyVersion: true,
      digitalMagazineVersion: true,
      digitalSpecialIssuesVersion: true,
      biweeklyDigitalPreview: true,
      magazineDigitalPreview: true,
      specialIssuesDigitalPreview: true,
      physicalBiweeklyVersion: true,
      physicalMagazineVersion: true,
      physicalSpecialIssuesVersion: true,
      exclusivity: true,
      premiumPosts: true,
      monthlyPrice: true,
      yearlyPrice: true,
      archivedAt: true,
      upgradable: true,
      trialFeatures: true,
    },
  },
  payment: {
    select: PAYMENT_PUBLIC_SELECT_INPUT,
  },
} as const satisfies Prisma.SubscriptionSelect;

export async function getActiveSubscription(user: User) {
  // last subscription related to a payment with the status succeeded
  // OR active trial subscription
  const r = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      OR: [
        activeSubscriptionWhereInput,
        {
          // Essai gratuit actif
          isTrial: true,
          trialEnd: { gte: new Date() },
        }
      ]
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      ...subscriptionPublicSelectInput,
      // Ajouter les champs d'essai
      isTrial: true,
      trialEnd: true,
      trialStarted: true,
      trialConvertedAt: true,
      // Ajouter les champs manquants pour la compatibilité avec Subscription type
      updatedById: true,
      userId: true,
      planId: true,
      paymentId: true,
      upgradeDescription: true,
    },
  });

  return r;
}

export function isActiveSubscription(
  subscription?:
    | (Pick<
        Subscription,
        "id" | "reference" | "period" | "expiresAt" | "createdAt" | "updatedAt" | "isTrial" | "trialEnd"
      > & {
        payment?: Pick<
          Payment,
          | "id"
          | "provider"
          | "reference"
          | "paidAmount"
          | "status"
          | "paidAmountCurrency"
          | "createdAt"
        > | null;
      })
    | null,
) {
  if (subscription) {
    // Vérifier si c'est un essai gratuit actif
    if (subscription.isTrial && subscription.trialEnd) {
      return moment(subscription.trialEnd).isAfter(moment());
    }
    
    // Vérification standard pour les abonnements payants
    // when the payment does not exists it is a custom subscription
    return (
      moment(subscription.expiresAt).isAfter(moment()) &&
      (!subscription.payment || subscription.payment.status === "succeeded")
    );
  } else {
    return false;
  }
}

export async function hasActiveSubscription(user: User) {
  return !!(await getActiveSubscription(user));
}
