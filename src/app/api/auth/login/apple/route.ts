import { generateUserToken } from "@/lib/auth/auth";
import prisma from "@/lib/prisma";
import { errorResponse, getClientIp, requestJsonBody } from "@/lib/utils/index";
import moment from "moment";
import { serializeError } from "serialize-error";
import { jwtVerify, createRemoteJWKSet } from "jose";

const appleJWKsUrl = 'https://appleid.apple.com/auth/keys';

export async function POST(req: Request) {
  try {
    const { idToken } = await requestJsonBody(req);

    if (!idToken) {
      return Response.json(
        { message: "Token Apple manquant" },
        { status: 400 }
      );
    }

    const JWKS = createRemoteJWKSet(new URL(appleJWKsUrl));

    // Vérification du token Apple
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: 'https://appleid.apple.com',
    });

    if (
      !payload ||
      typeof payload !== "object" ||
      !("email" in payload) ||
      !payload.sub
    ) {
      return Response.json({ message: "Token Apple invalide" }, { status: 400 });
    }

    const userEmail = payload.email as string;

    // Rechercher l'utilisateur dans la base de données
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return Response.json(
        { message: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    // Optionnel : vérifier que l'utilisateur s'est bien inscrit avec Apple
    // if (user.provider !== "apple") {
    //   return Response.json(
    //     { message: "Ce mail n'a pas été inscrit via Apple" },
    //     { status: 400 }
    //   );
    // }

    // Génération du token de session
    const session = await generateUserToken(user, {
      idAddress: req.headers.get("x-user-ip") ?? getClientIp(req),
      userAgent:
        req.headers.get("x-user-agent") ?? req.headers.get("user-agent")!,
    });

    return Response.json({
      token_type: "Bearer",
      access_token: session.sessionToken,
      expires: moment(session.expires).format(),
    });
  } catch (error) {
    return errorResponse(serializeError(error), { status: 500 });
  }
}
