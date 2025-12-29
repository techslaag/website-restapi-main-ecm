import { User } from "@prisma/client";
import { verify } from "jsonwebtoken";
import { serializeError } from "serialize-error";
import prisma from "../prisma";

/**
 * Authenticate a client request and forward the authenticated user
 *
 * @param req client request
 * @param cb callback
 * @returns Response
 */
export default async function authMiddleware(
  req: Request,
  cb: (user: User) => Promise<Response> | Response,
) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader ? authHeader.split(" ")[1] : undefined;

  // token not defined
  if (token === null || token === undefined) {
    return Response.json(
      { message: "L'en-tête d'autorisation est manquant." },
      {
        status: 401,
      },
    );
  }

  return await new Promise<Response>(async (resolve) => {
    try {
      // First verify the token and check expiry immediately
      let payload: { id: string; email: string; exp?: number; iat?: number };
      try {
        payload = verify(token, process.env.JWT_SECRET!) as any;
        
        // Check token expiry immediately after verification
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
          console.log("[AuthMiddleware] Token is expired!");
          return resolve(
            Response.json(
              { 
                message: "Token expiré. Veuillez vous reconnecter.",
                error: "TOKEN_EXPIRED" 
              },
              { status: 401 }
            )
          );
        }

        // Validate token age (optional: prevent very old tokens)
        if (payload.iat && (now - payload.iat) > 86400) { // 24 hours max
          console.log("[AuthMiddleware] Token too old!");
          return resolve(
            Response.json(
              { 
                message: "Session expirée. Veuillez vous reconnecter.",
                error: "TOKEN_TOO_OLD" 
              },
              { status: 401 }
            )
          );
        }
      } catch (tokenError) {
        console.error("[AuthMiddleware] Token verification failed:", tokenError);
        return resolve(
          Response.json(
            { 
              message: "Token invalide.",
              error: "INVALID_TOKEN" 
            },
            { status: 401 }
          )
        );
      }

      console.log("[AuthMiddleware] Token payload:", { id: payload.id, email: payload.email });

      // Load user and session in parallel for better performance
      const [user, tokenData] = await Promise.all([
        prisma.user.findUnique({
          where: { id: payload.id },
          select: {
            id: true,
            email: true,
            name: true,
            admin: true,
            emailVerified: true,
            image: true,
            createdAt: true
          }
        }),
        prisma.session.findFirst({
          where: {
            userId: payload.id,
            sessionToken: token,
          },
          select: {
            id: true,
            userId: true,
            expires: true
          }
        })
      ]);

      // Check if user exists and is active
      if (!user) {
        console.log("[AuthMiddleware] User not found:", payload.id);
        return resolve(
          Response.json(
            { 
              message: "L'utilisateur n'existe pas. Jeton d'accès corrompu.",
              error: "USER_NOT_FOUND" 
            },
            { status: 403 }
          )
        );
      }

      // Note: User activation check removed as the field doesn't exist in schema
      // If needed, add an 'active' field to the User model

      // Check if session exists and is valid
      if (!tokenData) {
        console.log("[AuthMiddleware] Session not found for user:", user.id);
        return resolve(
          Response.json(
            { 
              message: "Session invalide. Veuillez vous reconnecter.",
              error: "SESSION_NOT_FOUND" 
            },
            { status: 401 }
          )
        );
      }

      // Check session expiry
      if (tokenData.expires && new Date(tokenData.expires) <= new Date()) {
        console.log("[AuthMiddleware] Session expired for user:", user.id);
        return resolve(
          Response.json(
            { 
              message: "Session expirée. Veuillez vous reconnecter.",
              error: "SESSION_EXPIRED" 
            },
            { status: 401 }
          )
        );
      }

      console.log("[AuthMiddleware] Authentication successful for user:", user.id);
      // Inject the current user data in the request object
      Object.assign(req, { user });

      try {
        // Call the middleware callback with the authenticated user
        return resolve(await cb(user as any));
      } catch (error) {
        console.error("[AuthMiddleware] Callback error:", error);
        resolve(
          Response.json(
            {
              message: "Erreur interne du serveur.",
              error: "INTERNAL_ERROR",
              ...(process.env.NODE_ENV === "development" ? serializeError(error) : {})
            },
            { status: 500 }
          )
        );
      }
    } catch (error) {
      console.error("[AuthMiddleware] Unexpected error:", error);
      resolve(
        Response.json(
          {
            message: "Erreur d'authentification.",
            error: "AUTH_ERROR",
            ...(process.env.NODE_ENV === "development" ? serializeError(error) : {})
          },
          { status: 500 }
        )
      );
    }
  });
}
