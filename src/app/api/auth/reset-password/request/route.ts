import { sendEmail } from "@/lib/mail";
import buildResetPasswordEmail from "@/lib/mail/emails/buildResetPasswordEmail";
import prisma from "@/lib/prisma";
import { errorResponse, hashValue, requestJsonBody } from "@/lib/utils/index";
import { randomBytes } from "crypto";
import moment from "moment";
import { serializeError } from "serialize-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

// password reset validation schema
const passwordResetRequestSchema = z.object({
  email: z.string().email("A valid email is required."),
});

export async function POST(request: Request) {
  try {
    // register information
    const resetRequestPaylaod = passwordResetRequestSchema.parse(
      await requestJsonBody(request)
    );

    // check if the user exists in the system
    const user = await prisma.user.findFirst({
      where: { email: resetRequestPaylaod.email },
    });

    // user exists
    if (user) {
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
      const emails = await buildResetPasswordEmail(user, {
        identifier: verificationToken.identifier,
        token,
      });
      
      // send email
      await sendEmail(
        {
          to: user.email!,
          subject: "Mot de passe oublié",
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
        }
      );

      return Response.json(null);
    } else {
      return Response.json(
        {
          message: "Cet email n'existe pas dans notre système.",
        },
        { status: 400 }
      );
    }
  } catch (error) {
    return errorResponse(serializeError(error), { status: 500 });
  }
}
