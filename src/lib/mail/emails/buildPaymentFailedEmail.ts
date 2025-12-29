import IPaymentIntentMetaData from "@/interfaces/IPaymentIntentMetaData";
import { formatAmountCurrency } from "@/lib/utils/currencyFormat";
import { Payment, User } from "@prisma/client";
import Mailgen from "mailgen";
import getMailGenerator from "../mailGenerator";

export default function buildPaymentFailedEmail(
  payment: Payment & { user: User },
) {
  // payment meta
  const meta = JSON.parse(payment.meta as string) as IPaymentIntentMetaData;

  const emailSubject = (() => {
    switch (meta.product) {
      case "post":
      case "product":
      case "packageFw":
        return "Échec de l'achat";

      case "subscription":
        return "Échec de l'abonnement";
    }
  })();

  // email content
  const email: Mailgen.Content = {
    body: {
      name: payment.user.name ?? undefined,
      intro: [
        `Votre paiement a échoué. Modifiez votre mode de paiement et réessayez plus tard.`,
        "Merci pour votre confiance",
      ],
      dictionary: {
        Reférence: payment.reference,
        Montant: formatAmountCurrency(
          payment.paidAmount.toNumber(),
          payment.paidAmountCurrency,
        ),
      },
      outro:
        "<small>Répondez simplement à cet e-mail si le problème persiste.</small>",
      signature: "Cordialement",
    },
  };

  const mailGenerator = getMailGenerator();

  // Generate an HTML email with the provided contents
  const emailHtml: string = mailGenerator.generate(email);

  // Generate the plaintext version of the e-mail (for clients that do not support HTML)
  const emailText: string = mailGenerator.generatePlaintext(email);

  return {
    emailSubject,
    emailHtml,
    emailText,
  };
}
