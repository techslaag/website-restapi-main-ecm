import { Subscription, User, Plan } from "@prisma/client";
import Mailgen from "mailgen";
import moment from "moment";
import getMailGenerator from "../mailGenerator";

export default function buildExpiredSubscriptionEmail(
  subscription: Subscription & { user: User; plan: Plan }
) {
  const frontendUrl = process.env.NEXT_PUBLIC_FRONT_APP_URL || "https://ecomatin.net";
  const offersUrl = `${frontendUrl}/offers`;
  
  const email: Mailgen.Content = {
    body: {
      name: subscription.user.name ?? undefined,
      intro: [
        `Cher ${subscription.user.name ? subscription.user.name : 'abonné'},`,
        `Votre abonnement ${subscription.plan.title} a expiré le ${moment(subscription.expiresAt).format("DD/MM/YYYY")}.`,
        `Pour continuer à profiter de nos contenus exclusifs et analyses approfondies, nous vous invitons à renouveler votre abonnement.`,
      ],
      action: {
        instructions: "Cliquez sur le bouton suivant pour renouveler votre abonnement et retrouver immédiatement l'accès à tous nos services",
        button: {
          color: "#d11952",
          text: "  Renouveler mon abonnement  ",
          link: offersUrl,
        },
      },
      table: {
        data: [
          {
            item: "Plan expiré",
            description: subscription.plan.title,
            price: `Date d'expiration : ${moment(subscription.expiresAt).format("DD/MM/YYYY")}`,
          },
        ],
        columns: {
          customWidth: {
            item: "30%",
            description: "40%", 
            price: "30%",
          },
        },
      },
      outro: [
        "🔒 Votre compte reste actif, mais vous n'avez plus accès aux fonctionnalités premium.",
        "⚡ Renouvelez dès maintenant pour retrouver tous vos avantages exclusifs !",
        "",
        `Besoin d'aide ? Contactez notre équipe support qui sera ravie de vous accompagner. ${frontendUrl}/contact-us`,
      ],
      signature: "L'équipe EcoMatin",
    },
  };

  const mailGenerator = getMailGenerator();
  const emailHtml: string = mailGenerator.generate(email);
  const emailText: string = mailGenerator.generatePlaintext(email);

  // Generate dynamic subject line
  const subject = `${subscription.plan.title} - Votre abonnement EcoMatin a expiré`;

  return {
    subject,
    emailHtml,
    emailText,
  };
}