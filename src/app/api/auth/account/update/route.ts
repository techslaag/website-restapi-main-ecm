import { Password } from "@/lib/auth/Password";
import authMiddleware from "@/lib/auth/authMiddleware";
import { sendEmail } from "@/lib/mail";
import buildVerificationEmail from "@/lib/mail/emails/buildVerificationEmail";
import prisma from "@/lib/prisma";
import {
  errorResponse,
  excludeProps,
  hashValue,
  requestJsonBody,
} from "@/lib/utils/index";
import { randomBytes } from "crypto";
import moment from "moment";
import { serializeError } from "serialize-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

// registration validation schema
const updateSchema = z
  .object({
    name: z.string({ required_error: "Votre nom est requis" }),
    email: z
      .string({ required_error: "Votre adresse e-mail est nécessaire" })
      .email("L'adresse e-mail n'est pas valide"),
    password: z
      .string()
      .min(8, "Le mot de passe doit avoir au moins 8 caractères")
      .optional(),
    passwordConfirmation: z.string().optional(),
  })
  .refine(
    (data) => !data.password || data.password === data.passwordConfirmation,
    {
      message: "Le mot de passe et la confirmation ne correspondent pas",
      path: ["passwordConfirmation"],
    },
  );

export async function PUT(request: Request) {
  return authMiddleware(request, async (user) => {
    try {
      // register information
      const registerPayload = updateSchema.parse(
        await requestJsonBody(request),
      );

      // checking if the user email has changed
      const emailHasChanged =
        user.email?.toLowerCase() !== registerPayload.email.toLowerCase();

      // if the email has changed, we check if the new email is not already taken
      if (emailHasChanged) {
        // check the email unicity
        const existingEmailCount = await prisma.user.count({
          where: { email: registerPayload.email },
        });

        if (existingEmailCount !== 0) {
          throw {
            message: `Un utilisateur existe déjà avec l'e-mail ${registerPayload.email}.`,
          };
        }
      }

      // update account information
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: registerPayload.name,
          email: registerPayload.email,
          admin: false,
          emailVerified: emailHasChanged ? null : user.emailVerified,
          locale: request.headers.get("accept-language"),
          password: registerPayload.password
            ? await Password.hashPassword(registerPayload.password)
            : user.password,
          updatedAt: new Date(),
        },
      });

      // we send the verification link if the email has changed
      if (emailHasChanged) {
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
        const emails = await buildVerificationEmail(
          "email-verification",
          updatedUser,
          {
            scope: "email-verif",
            identifier: verificationToken.identifier,
            token,
          },
        );

        // send email
        await sendEmail(
          {
            to: updatedUser.email!,
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
      }

      return Response.json(excludeProps(updatedUser, ["password"]));
    } catch (error) {
      return errorResponse(serializeError(error), {
        status: 500,
      });
    }
  });
}
