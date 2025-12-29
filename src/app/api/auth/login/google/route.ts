import { NextApiRequest, NextApiResponse } from "next";
import { generateUserToken } from "@/lib/auth/auth";
import prisma from "@/lib/prisma";
import { errorResponse, getClientIp, requestJsonBody } from "@/lib/utils/index";
import moment from "moment";
import { serializeError } from "serialize-error";
import { jwtVerifyToken } from "@/lib/auth/jwtVerifyToken";

export async function POST(req: Request) {
  try {
    const { idToken } = await requestJsonBody(req);

    if (!idToken) {
      return Response.json({ message: "Token Google manquant" }, { status: 400 });
    }

    // Vérification du token
    const decoded = jwtVerifyToken(idToken);

    if (!decoded || typeof decoded.payload !== 'object' || !('email' in decoded.payload) || decoded.expired ) {
      return Response.json({ message: "Token invalide" }, { status: 400 });
    }

    const userEmail = decoded.payload.email as string;

    // Rechercher l'utilisateur
    let user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return Response.json({ message: "Utilisateur non trouvé" }, { status: 404 });
    }

    // Vérifier que l'utilisateur s'est inscrit avec Google
    // if (user.provider !== "google") {
    //   return Response.json(
    //     { message: "Cet email est déjà utilisé. Connectez-vous avec votre mot de passe." }, 
    //     { status: 400 }
    //   );
    // }

    // Génération du token de session
    const session = await generateUserToken(user, {
      idAddress: req.headers.get("x-user-ip") ?? getClientIp(req),
      userAgent: req.headers.get("x-user-agent") ?? req.headers.get("user-agent")!,
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
