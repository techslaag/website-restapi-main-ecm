import authMiddleware from "@/lib/auth/authMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

// validation schema
const schema = z.object({
  accessTokenOrId: z.string(),
});

export async function DELETE(request: Request) {
  return authMiddleware(request, async (user) => {
    try {
      // body data
      const payload = schema.parse(await requestJsonBody(request));

      // delete the session related to the access token
      await prisma.session.deleteMany({
        where: {
          userId: user.id,
          OR: [
            { sessionToken: payload.accessTokenOrId },
            { id: payload.accessTokenOrId },
          ],
        },
      });

      return Response.json(null);
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
