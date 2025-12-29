import { sendEmail } from "@/lib/mail";
import buildContactUsEmail from "@/lib/mail/emails/buildContactUsEmail";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import { z } from "zod";

// validation schema
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

export async function POST(request: Request) {
  try {
    // register information
    const bodyPayload = contactUsSchema.parse(await requestJsonBody(request));

    // generate verification emails
    const emails = await buildContactUsEmail({
      description: bodyPayload.description,
      email: bodyPayload.email,
      phoneNumber: bodyPayload.phoneNumber,
      subscriptionReference: bodyPayload.subscriptionReference,
    });

    // trigger an error in case failure
    await new Promise<any>(async (resolve, reject) => {
      // send email
      await sendEmail(
        {
          to: (() => {
            switch (bodyPayload.category) {
              case "complaint":
                return process.env.SUPPORT_EMAIL;

              case "business_offer":
              case "subscription_or_purchase":
                return process.env.SALES_EMAIL;

              default:
                return process.env.INFO_EMAIL;
            }
          })(),
          // to: "christianbakiti07@gmail.com",
          subject: bodyPayload.subject,
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

    return new Response(undefined, { status: 204 });
  } catch (error) {
    return errorResponse(serializeError(error), { status: 500 });
  }
}
