import authMiddleware from "@/lib/auth/authMiddleware";
import { sendEmail } from "@/lib/mail";
import buildVerificationEmail from "@/lib/mail/emails/buildVerificationEmail";
import prisma from "@/lib/prisma";
import { errorResponse, hashValue, requestJsonBody } from "@/lib/utils/index";
import { randomBytes } from "crypto";
import moment from "moment";
import { serializeError } from "serialize-error";
import { z } from "zod";

// validation schema
const schema = z.object({
  callbackUrl: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  return authMiddleware(request, async (user) => {
    try {
      // we only send the verification email if the email is not verified
      if (!user.emailVerified) {
        // verification information information
        const payload = schema.parse(await requestJsonBody(request));

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
          user,
          {
            scope: "email-verif",
            identifier: verificationToken.identifier,
            token,
            callbackUrl: payload.callbackUrl ?? undefined,
          },
        );

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
      }

      return new Response(undefined, {
        status: 204,
      });
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
