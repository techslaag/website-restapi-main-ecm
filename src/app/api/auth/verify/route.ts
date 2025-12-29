import prisma from "@/lib/prisma";
import { errorResponse, hashValue, requestJsonBody } from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

// login validation schema
const codeVerifySchema = z.object({
  scope: z.enum(["email-verif"], {
    required_error: "The verification scope is required.",
  }),
  identifier: z.string({ required_error: "The identifier is required" }),
  token: z.string({ required_error: "The token is required" }),
});

export async function POST(request: Request) {
  try {
    // verification information information
    const payload = codeVerifySchema.parse(await requestJsonBody(request));

    if (payload.scope === "email-verif") {
      // email verification code validation
      const hashedToken = hashValue(payload.token);

      // lookup user
      const user = await prisma.user.findFirst({
        where: {
          id: payload.identifier,
        },
      });

      // user exists
      if (user) {
        // lookup verification token
        const verificationToken = await prisma.verificationToken.findFirst({
          where: {
            identifier: payload.identifier,
            token: hashedToken,
            expires: {
              gte: new Date(),
            },
          },
        });

        // verification token exsists
        if (verificationToken) {
          // update email verification state
          await prisma.user.update({
            where: { id: user.id },
            data: {
              emailVerified: new Date(),
            },
          });

          // invalidate the verfication token
          await prisma.verificationToken.update({
            where: {
              identifier: verificationToken.identifier,
              token: verificationToken.token,
            },
            data: { expires: new Date() },
          });

          return Response.json(null);
        } else {
          return Response.json(
            {
              message: "Le jeton de vérification a expiré.",
            },
            { status: 403 }
          );
        }
      } else {
        return Response.json(
          {
            message: "Demande corrompue. Utilisateur non trouvé.",
          },
          { status: 400 }
        );
      }
    } else {
      return Response.json(
        {
          message: "La portée fournie n'est pas prise en charge.",
        },
        {
          status: 403,
        }
      );
    }
  } catch (error) {
    return errorResponse(serializeError(error), { status: 500 });
  }
}
