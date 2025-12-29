import IPackage, {
  PACKAGE_PUBLIC_SELECT_INPUT,
  toIPackage,
} from "@/interfaces/IPackageFw";
import authMiddleware from "@/lib/auth/authMiddleware";
import { syncFlutterwaveCronJob } from "@/lib/flutterwave/syncCronJob";
import countryAndExchangeRatesMiddleware from "@/lib/middlewares/countryAndExchangeRatesMiddleware";
import prisma from "@/lib/prisma";
import { createMobileMoneyFrancoPayment } from "@/lib/utils/flutterwaveUtils";
import {
  convertAmountToClientCurrency,
  requestJsonBody,
  roundToNext100,
} from "@/lib/utils";
import { serializeError } from "serialize-error";
import { z } from "zod";
import { sendEmail } from "@/lib/mail";
import buildContactUsEmail from "@/lib/mail/emails/buildContactUsEmail";


  /**
 * @swagger
 * /:
 *   post:
 *     summary: Processus d'inscription à la FinanceWeek 2024
 *     description: Permet aux utilisateurs de s'inscrire à la FinanceWeek 2024 et de finaliser leur paiement.
 *     tags:
 *       - FinanceWeek
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIp
 *               - postId
 *               - phoneNumber
 *             properties:
 *               userIp:
 *                 type: string
 *                 description: Adresse IP de l'utilisateur.
 *                 example: "192.168.1.1"
 *               postId:
 *                 type: string
 *                 description: Identifiant de l'article à acheter.
 *                 example: "42"
 *               phoneNumber:
 *                 type: string
 *                 description: Numéro de téléphone de l'utilisateur.
 *                 example: "+237691234567"
 *     responses:
 *       201:
 *         description: Inscription réussie.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 paymentId:
 *                   type: string
 *                   description: Identifiant du paiement confirmé.
 *                   example: "pay_123456789"
 *       400:
 *         description: Requête invalide ou utilisateur déjà inscrit.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Vous avez déjà acheté cet article. Merci de consulter vos achats."
 *       500:
 *         description: Erreur serveur.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Impossible de soumettre votre demande. Réessayez plus tard."
 */


export const dynamic = "force-dynamic";

const descriptionFofinanceweekuser= ` <p>Chers Participants,</p>
<p>
Nous avons le plaisir de vous confirmer votre inscription à la FinanceWeek 2024, un événement incontournable pour les acteurs du secteur financier de la région CEMAC. Nous vous remercions d’avoir souscrit via notre plateforme pour participer à cette édition placée sous le thème :
“Marché domestique des capitaux : un levier de croissance économique pour la CEMAC ?”
</p>
<p>
Un mot de passe ecomatin vous a egalement été attribuer. le voici: 12345678
</p>
    <p>
Vous pouvez l'utiliser pour vous connecter sur ecomatin.net
</p>
<p>
Détails de l’événement :
</p>
<ul>
<li>Date : 27 novembre 2024</li>
<li>Lieu : Starland Hôtel, Bastos, Yaoundé</li>
<li>Heure de début : 8h00</li>
</ul>
<p>
La FinanceWeek 2024 sera une occasion unique pour échanger sur les perspectives et les enjeux économiques de la sous-région, ainsi que pour envisager ensemble des solutions innovantes pour stimuler la croissance via le marché domestique des capitaux.
Nous vous invitons à vous présenter dès 7h30 pour les formalités d’accueil et à préparer toutes vos questions et idées pour les débats et tables rondes.
Pour toute information complémentaire, n’hésitez pas à nous contacter à contact@ecomatin.net.
</p>
<p>
Au plaisir de vous accueillir le 27 novembre prochain,
</p>
<p>
Cordialement,
</p>
<p>
L’équipe FinanceWeek
</p>
`;

const schema = z.object({
  userIp: z.string({
    required_error: "L'adresse ip de l'utilisateur est requise.",
  }),
  postId: z.string({
    required_error: "L'identifiant de l'article est obligatoire.",
  }),
  phoneNumber: z.string({
    required_error: "Le numéro de téléphone est obligatoire.",
  }),
});

function evaluatePostPrice(packagefw: IPackage) {
  // the post must have a price
  let value: number = Number(packagefw.price ?? 0);
  return {
    value,
    currency: packagefw.currency ?? "EUR",
  };
}

export async function POST(request: Request) {
  return authMiddleware(request, async (user) => {



    try {
      /**
       * Sync cron job url
       * ----------------------------
       */
      await syncFlutterwaveCronJob();

      // validate the body
      const bodyPayload = schema.parse(await requestJsonBody(request));
      const descriptionForFinanceweeAdmin = `
      <p>
      Bonjour ${process.env.FINANCE_WEEK_EMAIL},
      </p>
      <p>
Le souscripteur à l’adresse ${user.email} vient de finaliser son paiement pour sa participation à la FinanceWeek 2024.
  </p>
  <p>
  Rappel des information du participant : 
  </p>
      <ul>
      <li> Nom : ${user.name}</li>
      <li> Email : ${user.email}</li>
      <li> Numéro de téléphone : ${bodyPayload.phoneNumber}</li>
      </ul>
  
      <p>La souscription a été effectuée via la plateforme et est à présent confirmée. Vous pouvez accéder à l’ensemble des informations via votre espace administrateur.
  Bien cordialement,
      </p>
      <p>
  L’équipe de la FinanceWeek
      </p>
  
  `

      return await countryAndExchangeRatesMiddleware(
        bodyPayload.userIp,
        "eur",
        async (ipData, exchangeRates) => {
          // already own the post
          const purchase = await prisma.purchase.findFirst({
            where: {
              userId: user.id,
              postId: Number(bodyPayload.postId),
              payment: { status: "succeeded" },
            },
          });

          if (purchase) {
            return Response.json(
              {
                message:
                  "Vous avez déjà acheté cet article. Merci de consulter vos achats.",
              },
              {
                status: 400,
              },
            ); 
          } else {
            // check supported currency
            if (["xaf", "xof"].includes(ipData.currencyCode.toLowerCase())) {
              // fetch the post
              const postData = await prisma.mod180_posts.findUnique({
                where: { ID: Number(bodyPayload.postId) },
                select: PACKAGE_PUBLIC_SELECT_INPUT,
              });

              // post exists
              if (postData) {
                // convert post
                const post = toIPackage(postData);

                const baseAmount = evaluatePostPrice(post);

                // converted amount
                const amount = convertAmountToClientCurrency(
                  ipData,
                  exchangeRates,
                  baseAmount.value,
                  baseAmount.currency,
                );

                // adjusted amount
                const finalAmount = roundToNext100(amount.amount);

                // process the payment
                const result = await createMobileMoneyFrancoPayment(
                  ipData,
                  user,
                  "packageFw",
                  bodyPayload.phoneNumber,
                  {
                    currency: amount.currency,
                    value: finalAmount,
                  },
                  {
                    userId: user.id,
                    product: "packageFw",
                    packageId: post.id,
                  },
                );

                if (result.success) {

                  const emails = await buildContactUsEmail({
                    description: descriptionFofinanceweekuser,
                    email: user.email ?? '',
                    phoneNumber: bodyPayload.phoneNumber,
                    subscriptionReference: "",
                  });

                  const emailsForEcomatin = await buildContactUsEmail({
                    description: descriptionForFinanceweeAdmin,
                    email: process.env.FINANCE_WEEK_EMAIL!,
                    phoneNumber: "",
                    subscriptionReference: "",
                  });

                          await new Promise<any>(async (resolve, reject) => {
                      // Email pour ecomatin
                      await sendEmail(
                        {
                          to: process.env.FINANCE_WEEK_EMAIL,
                          // to: "christianbakiti07@gmail.com",
                          subject: "Nouvelle demande de participation pour la FinanceWeek 2024",
                          html: emailsForEcomatin.emailHtml,
                          text: emailsForEcomatin.emailText,
                        },
                        (err, info) => {
                          if (err) {
                            // failed to send the verification email
                            // error needs to be reported
                            reject({
                              message:
                                "Impossible de soumettre votre demande. Réessayez plus tard.",
                              ...(process.env.NODE_ENV !== "production" ? err : {}),
                            });
                          } else {
                            // the email has been successfully sent.
                            resolve(info);
                          }
                        },
                      );
                    });

                          // ceci est le mail destine au participant finance week
                  await new Promise<any>(async (resolve, reject) => {
                    // send email
                    await sendEmail(
                      {
                        // to: "christianbakiti07@gmail.com",
                        to: user.email ?? '',
                        subject: "Confirmation de votre inscription à la FinanceWeek 2024",
                        html: emails.emailHtml,
                        text: emails.emailText,
                      },
                      (err, info) => {
                        if (err) {
                          // failed to send the verification email
                          // error needs to be reported
                          reject({
                            message:
                              "Impossible de soumettre votre demande. Réessayez plus tard.",
                            ...(process.env.NODE_ENV !== "production" ? err : {}),
                          });
                        } else {
                          // the email has been successfully sent.
                          resolve(info);
                        }
                      },
                    );
                  });

                  return Response.json(result.data?.payment, {
                    status: 201,
                  });
                } else {
                  return Response.json(result.error, {
                    status: 400,
                  });
                }
              } else {
                return Response.json(
                  { message: "L'article est introuvable." },
                  { status: 400 },
                );
              }
            } else {
              return Response.json(
                {
                  message:
                    "Ce mode de paiement n'est pas supporté dans votre pays.",
                },
                { status: 400 },
              );
            }
          }
        },
      );
    } catch (error) {
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}
