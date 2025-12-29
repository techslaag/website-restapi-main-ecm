import { Password } from "@/lib/auth/Password";
import adminMiddleware from "@/lib/auth/adminMiddleware";
import { sendEmail } from "@/lib/mail";
import buildNewUserCredentialsEmail from "@/lib/mail/emails/buildNewUserCredentialsEmail";
import prisma from "@/lib/prisma";
import { generateSubscriptionReference } from "@/lib/referenceFactory";
import { errorResponse, hashValue, requestJsonBody } from "@/lib/utils/index";
import { randomBytes } from "crypto";
import moment from "moment";
import { serializeError } from "serialize-error";
import { z } from "zod";
import buildNewUserSubscriptionCredentialsEmail from "@/lib/mail/emails/buildNewUserSubscriptionCredentialsEmail";

// validation schema
const bodySchema = z.object({
  email: z
    .string({ required_error: "Votre adresse e-mail est nécessaire" })
    .email("L'adresse e-mail n'est pas valide"),
  subscription: z.object({
    planId: z.string({ required_error: "The plan ID is required" }),
    periodicity: z.enum(["month", "year"]),
    expiresAt: z.string().transform((str) => moment(str).toDate()),
  }),
});

export async function POST(request: Request) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      // register information
      const accountPayload = bodySchema.parse(await requestJsonBody(request));

      // check the email unicity
      const existingEmailCount = await prisma.user.count({
        where: { email: accountPayload.email },
      });

      // user doesn't already exists
      if (existingEmailCount !== 0) {
        const user = await prisma.user.findUnique({
          where: {
            email: accountPayload.email,
          },
        });

        if (user !== null) {
          // create subscription
          await prisma.subscription.create({
            data: {
              reference: await generateSubscriptionReference(),
              planId: accountPayload.subscription.planId,
              period: accountPayload.subscription.periodicity,
              userId: user.id,
              expiresAt: accountPayload.subscription.expiresAt,
              updatedAt: new Date(),
              updatedById: adminUser.id,
            },
          });

          const plan = await prisma.plan.findUnique({
            where: {
              id: accountPayload.subscription.planId,
            },
            select: {
              title: true,
            },
          });

          // generate verification emails
          const emails = buildNewUserSubscriptionCredentialsEmail(
            user,
            accountPayload.subscription,
            plan,
          );

          // send email
          await sendEmail(
            {
              to: user.email!,
              subject: "Ajout d'un plan d'abonnement au compte",
              html: emails.emailHtml,
              text: emails.emailText,
            },
            (err, info) => {
              if (err) {
                // failed to send the verification email
                // error needs to be reported
              } else {
                // the email has been successfully sent.
              }
            },
          );
          return Response.json(
            {
              message: "La souscription a été ajoutée avec succès.",
            },
            { status: 201 },
          );
        } else {
          return errorResponse("L'utilisateur n'existe pas.", { status: 404 });
        }
      } else {
        return Response.json(
          {
            message: "Cette adresse email est n'est rattachée à aucun compte.",
          },
          { status: 400 },
        );
      }
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
