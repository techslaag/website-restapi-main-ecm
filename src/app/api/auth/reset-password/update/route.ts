import { Password } from "@/lib/auth/Password";
import prisma from "@/lib/prisma";
import { errorResponse, hashValue, requestJsonBody } from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

// password reset validation schema
const passwordUpdateSchema = z
  .object({
    identifier: z.string({ required_error: "The identifier is required" }),
    token: z.string({ required_error: "The token is required" }),
    password: z
      .string()
      .min(8, "Le mot de passe doit comporter au moins 8 caractères."),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Le mot de passe et la confirmation ne correspondent pas",
    path: ["passwordConfirmation"],
  });

export async function POST(request: Request) {
  try {
    // register information
    const payload = passwordUpdateSchema.parse(await requestJsonBody(request));

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
            password: await Password.hashPassword(payload.password),
            passwordUpdatedAt: new Date(),
            updatedAt: new Date()
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
        {
          status: 400,
        }
      );
    }
  } catch (error) {
    return errorResponse(serializeError(error), { status: 500 });
  }
}
