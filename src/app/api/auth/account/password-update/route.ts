import { Password } from "@/lib/auth/Password";
import authMiddleware from "@/lib/auth/authMiddleware";
import prisma from "@/lib/prisma";
import { requestJsonBody } from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import { z } from "zod";

// validation schema
const bodySchema = z
  .object({
    currentPassword: z.string({
      required_error: "Le mot de passe actuelle est obligatoire.",
    }),
    password: z
      .string()
      .min(8, "Le mot de passe doit avoir au moins 8 caractères"),
    passwordConfirmation: z.string().optional(),
  })
  .refine(
    (data) => !data.password || data.password === data.passwordConfirmation,
    {
      message: "Le mot de passe et la confirmation ne correspondent pas",
      path: ["passwordConfirmation"],
    },
  );

export async function POST(request: Request) {
  return authMiddleware(request, async (user) => {
    try {
      // sign up type check
      if (user.signUpType === "created") {
        // payload
        const bodyPayload = bodySchema.parse(await requestJsonBody(request));

        // verify the password
        const isPasswordValid = await Password.comparePassword(
          user.password ?? "",
          bodyPayload.currentPassword,
        );

        if (isPasswordValid) {
          // update user
          await prisma.user.update({
            where: { id: user.id },
            data: {
              passwordUpdatedAt: new Date(),
              password: await Password.hashPassword(bodyPayload.password),
            },
          });

          return new Response(undefined, { status: 204 });
        } else {
          return Response.json(
            {
              message:
                "Le mot de passe actuel n'est pas valide. Vérifiez-le et réessayez.",
            },
            {
              status: 400,
            },
          );
        }
      } else {
        return Response.json(
          {
            message:
              "Seuls les comptes créés par les administrateurs système sont soumis à cette modification.",
          },
          {
            status: 400,
          },
        );
      }
    } catch (error) {
      return Response.json(serializeError(error), {
        status: 500,
      });
    }
  });
}
