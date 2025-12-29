import jwt, { JwtPayload } from 'jsonwebtoken';
import { User } from "@prisma/client";


export const jwtVerifyToken = (token: string, secret?: string): { valid: boolean, expired: boolean, payload?: JwtPayload } => {
  try {
    // Si un secret est fourni (cas pour les tokens signés avec un secret)
    const decoded = secret ? jwt.verify(token, secret) : jwt.decode(token);

    if (!decoded || typeof decoded !== 'object') {
      return { valid: false, expired: false };
    }

    // Vérification de l'expiration
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTime) {
      return { valid: true, expired: true, payload: decoded };
    }

    return { valid: true, expired: false, payload: decoded };
  } catch (error) {
    console.error("Token verification failed:", error);
    return { valid: false, expired: false };
  }
}
