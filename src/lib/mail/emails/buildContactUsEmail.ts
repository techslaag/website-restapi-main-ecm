import Mailgen from "mailgen";
import getMailGenerator from "../mailGenerator";

export default function buildContactUsEmail(data: {
  email: string;
  phoneNumber?: string | null;
  subscriptionReference?: string | null;
  description: string;
}) {
  const email: Mailgen.Content = {
    body: {
      dictionary: {
        Email: data.email,
        "Phone number": data.phoneNumber ?? "<i>Non renseigné</i>",
        "Numéro d'abonnement":
          data.subscriptionReference ?? "<i>Non renseigné</i>",
      },
      intro: data.description,
      outro:
        "<small>Ce mail à été envoyé dépuis le formulaire de contact du site d'EcoMatin.</small>",
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
