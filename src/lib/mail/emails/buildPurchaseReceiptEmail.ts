import { formatAmountCurrency } from "@/lib/utils/currencyFormat";
import { fetchPurchaseProductDetail } from "@/lib/utils/purchaseUtils";
import { Payment, Purchase, User } from "@prisma/client";
import Mailgen from "mailgen";
import moment from "moment";
import getMailGenerator from "../mailGenerator";

export default function buildPurchaseReceiptEmail(
  purchase: Purchase & { user: User; payment: Payment },
) {
  const productDetails = fetchPurchaseProductDetail(purchase.entityType);

  // email content
  const email: Mailgen.Content = {
    body: {
      name: purchase.user.name ?? undefined,
      intro: [
        `Votre achat a été enregistré avec succès.`,
        `Merci de votre confiance et profitez de votre ${productDetails.label} en toute sérénité.`,
      ],
      dictionary: {
        "Type du produit": productDetails.label,
        Reférence: purchase.payment.reference,
        "Payment status": purchase.payment?.status ?? "<i>Non renseigné</i>",
        Montant: formatAmountCurrency(
          purchase.payment.paidAmount.toNumber(),
          purchase.payment.paidAmountCurrency,
        ),
        "Date du paiement": moment(purchase.payment.createdAt).format(
          "DD/MM/YYYY",
        ),
      },
      action: {
        instructions:
          "Consulter vos achats dès maintenant en cliquant sur le boutton suivant:",
        button: {
          color: "#d11952",
          text: "Mes achats",
          link: `${process.env.NEXT_PUBLIC_FRONT_APP_URL}/member/purchases`,
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
    emailSubject: productDetails.subject,
    emailHtml,
    emailText,
  };
}
