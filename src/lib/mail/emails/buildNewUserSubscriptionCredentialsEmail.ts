import { injectQueryParams } from "@/lib/utils/index";
import { User } from "@prisma/client";
import Mailgen from "mailgen";
import getMailGenerator from "../mailGenerator";

export default function buildNewUserSubscriptionCredentialsEmail(
  user: User,
  subscription: {
    planId: string;
    periodicity: "month" | "year";
    expiresAt: Date;
  },
  plan: { title: string } | null,
) {
  const email: Mailgen.Content = {
    body: {
      name: user.name ?? undefined,
      intro: [
        `Une souscription vient d'être ajoutée à votre compte sur l'application ${
          process.env.NEXT_PUBLIC_APP_NAME ?? "EcoMatin"
        }.`,
        "Les informations consernant la souscription en question sont les suivantes :",
      ],
      dictionary: {
        Email: user.email,
        Plan: plan?.title,
        Periodicite:
          subscription.periodicity === "month" ? "Mensuel" : "Annuel",
        Expiration: subscription.expiresAt,
      },
      action: {
        instructions:
          "Connectez-vous dès maintenant afin de profiter de notre contenu .",
        button: {
          color: "#d11952",
          text: "Connectez-vous maintenant",
          link: injectQueryParams(
            `${process.env.NEXT_PUBLIC_FRONT_APP_URL}/auth/login`,
            {
              callbackUrl: `${process.env.NEXT_PUBLIC_FRONT_APP_URL}`, // redirect to the login form after verifying the email
            },
          ),
        },
      },
      outro:
        "Besoin d'aide ou avez des questions ? Répondez simplement à cet e-mail et nous serons heureux de vous aider",
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
