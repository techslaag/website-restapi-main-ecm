import { User } from "@prisma/client";
import { serializeError } from "serialize-error";
import authMiddleware from "./authMiddleware";

/**
 * Authenticate a client request and forward the authenticated user
 *
 * @param req client request
 * @param cb callback
 * @returns Response
 */
export default async function adminMiddleware(
  req: Request,
  cb: (user: User) => Promise<Response> | Response
) {
  return authMiddleware(req, async (user) => {
    if (user.admin) {
      try {
        // call the middleware callback
        return await cb(user);
      } catch (error) {
        return Response.json(serializeError(error), {
          status: 500,
        });
      }
    } else {
      return Response.json(
        {
          message: "Vous n'etes pas autorisé à accéder à cette resource.",
        },
        {
          status: 403,
        }
      );
    }
  });
}
