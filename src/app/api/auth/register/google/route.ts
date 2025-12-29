import { NextApiRequest, NextApiResponse } from "next";
import { generateUserToken } from "@/lib/auth/auth";
import prisma from "@/lib/prisma";
import automationService from "@/lib/services/automationService";
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

    // Vérifier l'ID Token
    const decoded = jwtVerifyToken(idToken);
    if (!decoded || !decoded.payload?.email || decoded.expired ) {
      return Response.json({ message: "Token invalide" }, { status: 400 });
    }

    // Rechercher l'utilisateur dans la base de données
    let user = await prisma.user.findUnique({
      where: { email: decoded.payload.email },
    });

    let isNewUser = false;
    if (!user) {
      // Créer l'utilisateur s'il n'existe pas
      user = await prisma.user.create({
        data: {
          email: decoded.payload.email,
          name: decoded.payload.name,
          provider: "google",
        },
      });
      isNewUser = true;
    } 
    // else if (user.provider !== "google") {
    //   return Response.json(
    //     { message: "Cet email est déjà utilisé. Connectez-vous avec votre mot de passe." },
    //     { status: 400 }
    //   );
    // }

    // 🎯 Déclencher automatiquement la série de bienvenue pour les nouveaux utilisateurs
    if (isNewUser) {
      await automationService.triggerWelcomeSeriesForNewUser(user.id);
    }

    // Générer un token d'authentification
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
