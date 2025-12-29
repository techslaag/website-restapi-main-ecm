import { Password } from "@/lib/auth/Password";
import { generateUserToken } from "@/lib/auth/auth";
import { sendEmail } from "@/lib/mail";
import buildVerificationEmail from "@/lib/mail/emails/buildVerificationEmail";
import prisma from "@/lib/prisma";
import automationService from "@/lib/services/automationService";
import {
  errorResponse,
  getClientIp,
  hashValue,
  requestJsonBody,
} from "@/lib/utils/index";
import { randomBytes } from "crypto";
import moment from "moment";
import { serializeError } from "serialize-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

// registration validation schema
const registerSchema = z
  .object({
    name: z.string({ required_error: "Votre nom est requis" }),
    email: z
      .string({ required_error: "Votre adresse e-mail est nécessaire" })
      .email("L'adresse e-mail n'est pas valide"),
    password: z
      .string()
      .min(8, "Le mot de passe doit avoir au moins 8 caractères"),
    passwordConfirmation: z.string(),
    interests: z.array(z.string()).optional(), // Make interests optional for backward compatibility
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Le mot de passe et la confirmation ne correspondent pas",
    path: ["passwordConfirmation"],
  });

export async function POST(request: Request) {
  try {
    // register information
    const registerPayload = registerSchema.parse(
      await requestJsonBody(request),
    );

    // check the email unicity
    const existingEmailCount = await prisma.user.count({
      where: { email: registerPayload.email },
    });

    // user doesn't already exists
    if (existingEmailCount === 0) {
      // create the new user
      const user = await prisma.user.create({
        data: {
          name: registerPayload.name,
          email: registerPayload.email,
          admin: false,
          emailVerified: null,
          locale: request.headers.get("accept-language"), // default language of the user
          password: await Password.hashPassword(registerPayload.password),
        },
      });

      // If interests are provided, save them
      if (registerPayload.interests && registerPayload.interests.length > 0) {
        // Create UserInterest entries for each selected interest
        await prisma.userInterest.createMany({
          data: registerPayload.interests.map(interestId => ({
            userId: user.id,
            interestId: interestId,
          })),
        });

        // Also create/update the user's preference record for backward compatibility
        // Note: Preference model doesn't have an interests field based on the schema
        // If needed in the future, we can add categories field handling here
      }

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

      // generate verification emails
      const emails = await buildVerificationEmail("welcome", user, {
        scope: "email-verif",
        identifier: verificationToken.identifier,
        token,
      });

      // send email
      await sendEmail(
        {
          to: user.email!,
          subject: "Verification email",
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

      /**
       * the x-auto-auth header is used to auto authenticate the user and return an access token
       */
      if (request.headers.get("x-auto-auth") === "true") {
        // generate a session
        const session = await generateUserToken(user, {
          idAddress: request.headers.get("x-user-ip") ?? getClientIp(request),
          userAgent:
            request.headers.get("x-user-agent") ??
            request.headers.get("user-agent")!,
        });

        return Response.json({
          token_type: "Bearer",
          access_token: session.sessionToken,
          expires: moment(session.expires).format(),
        });
      } else {
        return  Response.json(user, { status: 200 });
      }
    } else {
      return Response.json(
        {
          message: `Un utilisateur existe déjà avec l'e-mail ${registerPayload.email}.`,
        },
        {
          status: 400,
        },
      );
    }
  } catch (error) {
    return errorResponse(serializeError(error), { status: 500 });
  }
}
