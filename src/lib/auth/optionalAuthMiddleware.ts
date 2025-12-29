import { User } from "@prisma/client";
import { verify } from "jsonwebtoken";
import prisma from "../prisma";
import { serializeError } from "serialize-error";

/**
 * Authenticate a client request and forward the authenticated user
 *
 * @param req client request
 * @param cb callback
 * @returns Response
 */
export default async function optionalAuthMiddleware(
  req: Request,
  cb: (user?: User) => Promise<Response> | Response,
) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader ? authHeader.split(" ")[1] : undefined;

    return new Promise<Response>(async (resolve) => {
      let user: User | null = null;
      let hasActiveSession: boolean = false;

      if (!token !== null && token !== undefined) {
        try {
          // verify the access token and extract the payload
          const payload: { id: string; email: string } = verify(
            token,
            process.env.JWT_SECRET!,
          ) as any;

          // load the user from the database
          user = await prisma.user.findUnique({
            where: {
              id: payload.id,
            },
          });

          // user doesn't exists in the database
          if (user) {
            // load session
            const tokenData = await prisma.session.findFirst({
              where: {
                userId: user.id,
                sessionToken: token,
              },
            });

            // check if the user ha
            hasActiveSession = !!tokenData;
          }
        } catch (error) {
          // we don't do anything in case of error
          // we may send the error to an error tracking app
        }
      }

      // call the middleware callback
      resolve(
        await cb(hasActiveSession ? (user ?? undefined) : undefined),
      );
    });
  } catch (error) {
    return Response.json(
      {
        error: serializeError(error),
      },
      {
        status: 500,
      },
    );
  }
}
