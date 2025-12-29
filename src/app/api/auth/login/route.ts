import { Password } from "@/lib/auth/Password";
import { generateUserToken } from "@/lib/auth/auth";
import prisma from "@/lib/prisma";
import { errorResponse, getClientIp, requestJsonBody } from "@/lib/utils/index";
import moment from "moment";
import { serializeError } from "serialize-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

// login validation schema
const loginSchema = z.object({
  email: z
    .string({ required_error: "Votre adresse e-mail est nécessaire" })
    .email("Une adresse courriel valide est requise"),
  password: z.string({ required_error: "Le mot de passe est requis" }),
});

export async function POST(request: Request) {
  try {
    // register information
    const payload = loginSchema.parse(await requestJsonBody(request));

    // lookup user
    const user = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    // user exists
    if (user) {
      // password not defined
      if (user.password) {
        // verify the password
        const isPasswordValid = await Password.comparePassword(
          user.password ?? "",
          payload.password,
        );

        if (isPasswordValid) {
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
          return Response.json(
            {
              message: "Email ou mot de passe incorrect.",
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
              "Identifiants incorrects. Passez par la récupération du mot de passe.",
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
            "Aucun compte trouvé. Vérifiez vos informations d'identification",
        },
        { status: 400 },
      );
    }
  } catch (error) {
    return errorResponse(serializeError(error), {
      status: 500,
    });
  }
}
