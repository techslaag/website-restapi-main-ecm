import { Subscription, User, Plan } from "@prisma/client";
import Mailgen from "mailgen";
import moment from "moment";
import getMailGenerator from "../mailGenerator";

export default function buildSubscriptionReminderEmail(
  subscription: Subscription & { user: User; plan: Plan },
  daysLeft: number
) {
  const email: Mailgen.Content = {
    body: {
      name: subscription.user.name ?? undefined,
      intro: [
        `Votre abonnement ${subscription.plan.title} arrive à expiration le ${moment(subscription.expiresAt).format("DD/MM/YYYY")}.`,
        `Il vous reste ${daysLeft} jour${daysLeft > 1 ? "s" : ""} pour le renouveler et continuer à profiter de nos services sans interruption.`,
      ],
      action: {
        instructions: "Cliquez sur le bouton suivant pour renouveler votre abonnement :",
        button: {
          color: "#d11952",
          text: "Renouveler mon abonnement",
          link: `https://testing.ecomatin.be/offers`,
        },
      },
      outro: "Si vous avez déjà renouvelé, merci d'ignorer ce message.",
      signature: "Cordialement",
    },
  };

  const mailGenerator = getMailGenerator();
  const emailHtml: string = mailGenerator.generate(email);
  const emailText: string = mailGenerator.generatePlaintext(email);

  return {
    emailHtml,
    emailText,
  };
} 