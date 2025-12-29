import { injectQueryParams } from "@/lib/utils/index";
import { User } from "@prisma/client";
import Mailgen from "mailgen";
import getMailGenerator from "../mailGenerator";

export default function buildVerificationEmail(
  callContext: "welcome" | "email-verification",
  user: User,
  data: {
    scope: "email-verif";
    identifier: string;
    token: string;
    callbackUrl?: string;
  },
) {
  const email: Mailgen.Content = {
    body: {
      name: user.name ?? undefined,
      intro:
        callContext === "welcome"
          ? `Bienvenue sur ${
              process.env.NEXT_PUBLIC_APP_NAME ?? "EcoMatin"
            } ! Nous sommes très heureux de vous avoir à bord.`
          : undefined,
      action: {
        instructions: (() => {
          switch (callContext) {
            case "welcome":
              return "Pour démarrer, verifiez votre adresse email en cliquant sur le lien suivant:";

            default:
              return "Verifiez votre adresse email en cliquant sur le lien suivant:";
          }
        })(),
        button: {
          color: "#d11952",
          text: "Confirmez votre compte",
          link: injectQueryParams(
            `${process.env.NEXT_PUBLIC_FRONT_APP_URL}/api/auth/verify`,
            data,
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
