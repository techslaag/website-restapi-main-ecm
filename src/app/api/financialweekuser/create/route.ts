import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from "zod";
import { sendEmail } from "@/lib/mail";
import buildContactUsEmail from "@/lib/mail/emails/buildContactUsEmail";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

// Enum de package type
const PackageType = z.enum(['PREMIUM', 'PARTENAIRE', 'SOUTIENT']);

const createUserSchema = z.object({
  userId: z.string().max(100),
  nom: z.string().max(100),
  email: z.string().max(100),
  package: z.string().max(100),
  entreprise: z.string().max(100),
  poste: z.string().max(50),
  phone: z.string().min(9).max(15),
});

const contactUsSchema = z.object({
  category: z.enum(
    [
      "business_offer",
      "subscription_or_purchase",
      "complaint",
      "suggestion",
      "other",
    ],
    { required_error: "La categorie est requise." },
  ),
  email: z
    .string({ required_error: "Votre adresse e-mail est nécessaire" })
    .email("L'adresse e-mail n'est pas valide"),
  phoneNumber: z.string().optional().nullable(),
  subscriptionReference: z.string().optional().nullable(), // code required here: must be verified when present
  subject: z.string({ required_error: "Le sujet est requis" }).min(1, {
    message: "Le sujet est requis",
  }),
  description: z
    .string({ required_error: "La description est requis" })
    .min(1, {
      message: "La description est requise",
    }),
});

export async function POST(req: NextRequest) {

  try {
    const body = await req.json();

    // Valider le corps de la requête avec zod
    const registerPayload = createUserSchema.parse(body);
    const descriptionFofinanceweekuser= ` <p>Chers Participants,</p>
    <p>
  Nous avons bien reçu votre demande de participation pour la **Finance Week 2024**.
</p>

<p>
  Pour finaliser votre inscription, veuillez procéder au paiement par Carte bancaire sur <a href="https://buy.stripe.com/3csaGdbIM8c1a6Q146">ici</a> ou par Mobile Money <a href="https://flutterwave.com/pay/tavuao1gyltj">ici</a>.
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
    const descriptionForFinanceweeAdmin = `
    <p>
    Bonjour ${process.env.FINANCE_WEEK_EMAIL},
    </p>
    <p>
Une nouvelle création de compte vient d’être enregistrée pour participer à la FinanceWeek 2024. Voici les détails du participant :
    </p>
    <p>
    Le paiment n'a pas encore ete reçu 
    </p>
    <ul>
    <li> Nom : ${registerPayload.nom}</li>
    <li> Email : ${registerPayload.email}</li>
    <li> Numéro de téléphone : ${registerPayload.phone}</li>
    </ul>

    <p>Vous pouvez accéder à l’ensemble des informations via votre espace administrateur.
Bien cordialement,
    </p>
    <p>
L’équipe de la FinanceWeek
    </p>

`
// const descriptionFofinanceweekuserForPremiunm= ` <p>Bonjour ${registerPayload.nom},
// </p>
// <p>
// Nous vous remercions d’avoir complété le formulaire de contact pour la FinanceWeek 2024. Votre demande a bien été reçue et est en cours de traitement par notre équipe.
// </p>
//   <p>
//     Un mot de passe ecomatin vous a egalement été attribuer. le voici: 12345678
//     </p>
//     <p>
//     Vous pouvez l'utiliser pour vous connecter sur ecomatin.net
//     </p>
// <p>
// Nous reviendrons vers vous dans les plus brefs délais avec les informations et l’assistance nécessaires pour répondre à vos questions et préparer votre participation à l’événement.
// </p>
// <p>
// Si vous avez d’autres questions en attendant, n’hésitez pas à nous contacter directement à l’adresse contact@ecomatin.net ou par téléphone au (+237) 6 90 84 83 07.
// </p> 

// <p>
// Bien Cordialement,
// </p>
// <p>
// L’équipe FinanceWeek
// </p>
// `;

const descriptionForFinanceweeAdminPremium = `
<p>
Bonjour ${process.env.FINANCE_WEEK_EMAIL},
</p>
<p>
Un nouvel utilisateur vient de s’enregistrer sur le formulaire de la FinanceWeek 2024 via la plateforme. Voici les détails du participant : 
</p>
<ul>
<li> Nom du client  : ${registerPayload.nom}</li>
<li> Email : ${registerPayload.email}</li>
<li> Numéro de téléphone : ${registerPayload.phone}</li>
<li> Objet de la demande : Inscription FinanceWeek pack ${registerPayload.package}</li>
</ul>
</p>
<p>
Merci de bien vouloir prendre en charge cette demande et de revenir vers le client dès que possible pour lui apporter l’assistance souhaitée.
</p>

<p>Bien cordialement,
</p>
<p>
L’équipe de la FinanceWeek
</p>
`
    // Créer un nouvel utilisateur dans la base de données
    const newUser = await prisma.financialWeekUser.create({
      data: {
        userId: registerPayload.userId,
        enterprise: registerPayload.entreprise,
        job: registerPayload.poste,
        phone: registerPayload.phone,

      },
    });


    try {
      // register information
      // const bodyPayload = contactUsSchema.parse(await requestJsonBody(req));
  
      // generate verification emails
      // email: registerPayload.email,

      const emails = await buildContactUsEmail({
        description: descriptionFofinanceweekuser,
        email: registerPayload.email,
        phoneNumber: registerPayload.phone,
        subscriptionReference: "",
      });

      // ceci est le mail destine a l'admin ecomatin
      // const emailsForEcomatin = await buildContactUsEmail({
      //   description: descriptionForFinanceweeAdmin,
      //   email: process.env.FINANCE_WEEK_EMAIL!,
      //   phoneNumber: "",
      //   subscriptionReference: "",
      // });

      const emailsForEcomatinPremium = await buildContactUsEmail({
        description: descriptionForFinanceweeAdminPremium,
        email: process.env.FINANCE_WEEK_EMAIL!,
        phoneNumber: "",
        subscriptionReference: "",
      });


        //email pour ecomatin
        await new Promise<any>(async (resolve, reject) => {
          // send email
          await sendEmail(
            {
              to: process.env.FINANCE_WEEK_EMAIL,
              // to: "christianbakiti07@gmail.com",
              subject: "Nouvelle enregistrement reçue – FinanceWeek 2024",
              html: emailsForEcomatinPremium.emailHtml,
              text: emailsForEcomatinPremium.emailText,
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
  
  
        // ceci est le mail destine au participant finance week premium
        // await new Promise<any>(async (resolve, reject) => {
        //   await sendEmail(
        //     {
        //       // to: "christianbakiti07@gmail.com",
        //       to: registerPayload.email,
        //       subject: " Confirmation de réception de votre demande – FinanceWeek 2024",
        //       html: emailsForUserPremium.emailHtml,
        //       text: emailsForUserPremium.emailText,
        //     },
        //     (err, info) => {
        //       if (err) {
        //         // failed to send the verification email
        //         // error needs to be reported
        //         reject({
        //           message:
        //             "Impossible de soumettre votre demande. Réessayez plus tard.",
        //           ...(process.env.NODE_ENV !== "production" ? err : {}),
        //         });
        //       } else {
        //         // the email has been successfully sent.
        //         resolve(info);
        //       }
        //     },
        //   );
        // });


        ////////////////////////////////////////////////////////////////////////////////////////////////////
        // await new Promise<any>(async (resolve, reject) => {
        //   // Email pour ecomatin
        //   await sendEmail(
        //     {
        //       to: process.env.FINANCE_WEEK_EMAIL,
        //       // to: "christianbakiti07@gmail.com",
        //       subject: "Nouvelle demande de participation pour la FinanceWeek 2024",
        //       html: emailsForEcomatin.emailHtml,
        //       text: emailsForEcomatin.emailText,
        //     },
        //     (err, info) => {
        //       if (err) {
        //         // failed to send the verification email
        //         // error needs to be reported
        //         reject({
        //           message:
        //             "Impossible de soumettre votre demande. Réessayez plus tard.",
        //           ...(process.env.NODE_ENV !== "production" ? err : {}),
        //         });
        //       } else {
        //         // the email has been successfully sent.
        //         resolve(info);
        //       }
        //     },
        //   );
        // });
  
  
        // ceci est le mail destine au participant finance week
        await new Promise<any>(async (resolve, reject) => {
          // send email
          await sendEmail(
            {
              // to: "christianbakiti07@gmail.com",
              to: registerPayload.email,
              subject: "Demande de participation à la FinanceWeek 2024",
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
      

      // trigger an error in case failure

  
      return new Response(undefined, { status: 204 });
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }


















    // Retourner la réponse avec succès

    return NextResponse.json(newUser);

  } catch (error) {
    console.error("Erreur lors de la création de l'utilisateur:", error);

    // Retourner un message d'erreur en fonction de l'origine de l'erreur
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
