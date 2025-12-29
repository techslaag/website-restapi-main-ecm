import { injectQueryParams } from "@/lib/utils/index";
import { User } from "@prisma/client";
import Mailgen from "mailgen";
import getMailGenerator from "../mailGenerator";

export default function buildNewUserCredentialsEmail(
  user: User,
  password: string,
  data: {
    scope: "email-verif";
    identifier: string;
    token: string;
  },
) {
  const email: Mailgen.Content = {
    body: {
      name: user.name ?? undefined,
      intro: [
        `Un compte a été créé pour vous sur l'application ${
          process.env.NEXT_PUBLIC_APP_NAME ?? "EcoMatin"
        }.`,
        "Vos identifiants provisoires sont les suivants :",
      ],
      dictionary: {
        Email: user.email,
        "Mot de passe": password,
      },
      action: {
        instructions:
          "Vous serez invité à modifier votre mot de passe après vous être connecté.",
        button: {
          color: "#d11952",
          text: "Connectez-vous maintenant",
          link: injectQueryParams(
            `${process.env.NEXT_PUBLIC_FRONT_APP_URL}/api/auth/verify`,
            {
              ...data,
              callbackUrl: `${process.env.NEXT_PUBLIC_FRONT_APP_URL}/auth/login`, // redirect to the login form after verifying the email
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
