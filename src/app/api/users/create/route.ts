import { Password } from "@/lib/auth/Password";
import adminMiddleware from "@/lib/auth/adminMiddleware";
import { sendEmail } from "@/lib/mail";
import buildNewUserCredentialsEmail from "@/lib/mail/emails/buildNewUserCredentialsEmail";
import prisma from "@/lib/prisma";
import { generateSubscriptionReference } from "@/lib/referenceFactory";
import { errorResponse, hashValue, requestJsonBody } from "@/lib/utils/index";
import automationService from "@/lib/services/automationService";
import { randomBytes } from "crypto";
import moment from "moment";
import { serializeError } from "serialize-error";
import { z } from "zod";

// validation schema
const bodySchema = z
  .object({
    name: z.string({ required_error: "Votre nom est requis" }),
    email: z
      .string({ required_error: "Votre adresse e-mail est nécessaire" })
      .email("L'adresse e-mail n'est pas valide"),
    type: z.enum(["default", "subscriber"]).optional(),
    customPassword: z.string().optional(),
    subscription: z
      .object({
        planId: z.string({ required_error: "The plan ID is required" }),
        periodicity: z.enum(["month", "year"]),
        expiresAt: z.string().transform((str) => moment(str).toDate()),
      })
      .optional(),
  })
  .superRefine(({ type, subscription }, refinementContext) => {
    if (type === "subscriber" && !subscription) {
      return refinementContext.addIssue({
        code: z.ZodIssueCode.custom,
        message: `The subscription details is required when the type value is "${type}"`,
        path: ["subscription"],
      });
    }
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
      if (existingEmailCount === 0) {
        // user password - use custom password if provided, otherwise generate one
        const newUserPassword = accountPayload.customPassword || randomBytes(8).toString("hex");

        // create the new user
        const user = await prisma.user.create({
          data: {
            signUpType: "created",
            name: accountPayload.name,
            email: accountPayload.email,
            admin: false,
            emailVerified: null,
            password: await Password.hashPassword(newUserPassword),
          },
        });

        // generate verification token
        const token = randomBytes(16).toString("hex");
        // hashed version of the token
        const hashedToken = hashValue(token);

        // email verification
        const verificationToken = await prisma.verificationToken.create({
          data: {
            identifier: user.id,
            token: hashedToken,
            expires: moment().add(14, "minutes").toDate(),
          },
        });

        // create user subscription
        let subscription = null;
        if (
          accountPayload.type === "subscriber" &&
          !!accountPayload.subscription
        ) {
          // create subscription
          subscription = await prisma.subscription.create({
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
        }

        // generate verification emails
        const emails = await buildNewUserCredentialsEmail(
          user,
          newUserPassword,
          {
            scope: "email-verif",
            identifier: verificationToken.identifier,
            token,
          },
        );

        // send email
        await sendEmail(
          {
            to: user.email!,
            subject: "Identifiants de compte",
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

        // 🎯 Déclencher automatiquement la série de bienvenue pour le nouvel utilisateur
        await automationService.triggerWelcomeSeriesForNewUser(user.id);

        // 🔄 Si l'utilisateur a un abonnement, déclencher l'automation de renouvellement
        if (subscription) {
          await automationService.triggerRenewalAutomationForUser(user.id, subscription.expiresAt);
        }

        const response: any = {
          message: "Le compte a été créé avec succès.",
        };

        // Include password in response only if it was auto-generated (not custom)
        if (!accountPayload.customPassword) {
          response.password = newUserPassword;
        }

        return Response.json(response, { status: 201 });
      } else {
        return Response.json(
          {
            message:
              "Cette adresse email est déjà utilisée par un autre compte.",
          },
          { status: 400 },
        );
      }
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
