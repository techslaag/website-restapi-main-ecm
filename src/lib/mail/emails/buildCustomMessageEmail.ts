import Mailgen from "mailgen";
import getMailGenerator from "../mailGenerator";

interface CustomEmailOptions {
  subject?: string;
  message: string;
  actionButton?: {
    text: string;
    link: string;
  };
}

interface UserForEmail {
  name: string | null;
}

export default function buildCustomMessageEmail(
  user: UserForEmail,
  options: CustomEmailOptions
) {
  const frontendUrl = process.env.NEXT_PUBLIC_FRONT_APP_URL || "https://ecomatin.net";
  const email: Mailgen.Content = {
    body: {
      name: user.name ?? undefined,
      intro: [
        `Cher ${user.name ? user.name : 'utilisateur'},`,
        ...options.message.split('\n').filter(line => line.trim()),
      ],
      action: options.actionButton ? {
        instructions: "",
        button: {
          color: "#d11952",
          text: options.actionButton.text,
          link: options.actionButton.link,
        },
      } : undefined,
      outro: [
        "Merci de votre confiance et de votre fidélité.",
        `Pour toute question, n'hésitez pas à contacter notre équipe support : ${frontendUrl}/contact-us`,
      ],
      signature: "L'équipe EcoMatin",
    },
  };

  const mailGenerator = getMailGenerator();
  const emailHtml: string = mailGenerator.generate(email);
  const emailText: string = mailGenerator.generatePlaintext(email);

  return {
    emailHtml,
    emailText,
    subject: options.subject || "Message d'EcoMatin",
  };
}