import { injectQueryParams } from "@/lib/utils/index";
import { User } from "@prisma/client";
import Mailgen from "mailgen";
import getMailGenerator from "../mailGenerator";

export default function buildResetPasswordEmail(
  user: User,
  data: {
    identifier: string;
    token: string;
  },
) {
  const email: Mailgen.Content = {
    body: {
      name: user.name ?? undefined,
      intro: "Vous avez récemment souligné avoir oublié votre mot de passe.",
      action: {
        instructions:
          "Cliquez sur le bouton suivant pour réinitialiser votre mot de passe.:",
        button: {
          color: "#d11952",
          text: "Modifier mon mot de passe",
          link: injectQueryParams(
            `${process.env.NEXT_PUBLIC_FRONT_APP_URL}/auth/reset-password/update`,
            data,
          ),
        },
      },
      outro:
        "Si vous n'avez pas initié cette action, veuillez simplement ignorer cet e-mail.",
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
