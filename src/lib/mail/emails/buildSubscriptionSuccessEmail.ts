import { formatAmountCurrency } from "@/lib/utils/currencyFormat";
import { Payment, Plan, Subscription, User } from "@prisma/client";
import Mailgen from "mailgen";
import moment from "moment";
import getMailGenerator from "../mailGenerator";

export default function buildSubscriptionSuccessEmail(
  subscription: Subscription & {
    user: User;
    plan: Plan;
    payment: Payment | null;
  },
) {
  const email: Mailgen.Content = {
    body: {
      name: subscription.user.name ?? undefined,
      intro: [
        `Votre abonnement ${subscription.plan.title} a été activé avec succès et expire à la date du ${moment(subscription.expiresAt).format("DD/MM/YYYY")}.`,
        "Merci pour votre confiance et profitez des meilleures informations économiques en toute sérénité.",
      ],
      dictionary: {
        Reférence: subscription.payment?.reference ?? "<i>Non renseigné</i>",
        "Payment status":
          subscription.payment?.status ?? "<i>Non renseigné</i>",
        "Numéro d'abonnement": subscription.reference,
        Montant: subscription.payment
          ? formatAmountCurrency(
              subscription.payment.paidAmount.toNumber(),
              subscription.payment.paidAmountCurrency,
            )
          : "<i>Non renseigné</i>",
      },
      action: {
        instructions:
          "Cliquez sur le bouton suivant pour accéder à votre espace membre:",
        button: {
          color: "#d11952",
          text: "Mon espace",
          link: `${process.env.NEXT_PUBLIC_FRONT_APP_URL}/member/subscription`,
        },
      },
      signature: "Cordialement",
    },
  };

  const mailGenerator = getMailGenerator();

  // Generate an HTML email with the provided contents
  const emailHtml: string = mailGenerator.generate(email);

  // Generate the plaintext version of the e-mail (for clients that do not support HTML)
  const emailText: string = mailGenerator.generatePlaintext(email);

  return {
    emailHtml,
    emailText,
  };
}
