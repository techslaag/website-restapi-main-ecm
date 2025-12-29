import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/utils/index";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params: { id: newsletterId } }: { params: { id: string } },
) {
  return adminMiddleware(request, async () => {
    try {
      // newsletter instance
      const newsletter = await prisma.newsletter.findUnique({
        where: { id: newsletterId },
      });

      // newsletter exists
      if (newsletter) {
        // delete newsletter
        await prisma.newsletter.delete({ where: { id: newsletter.id } });

        // code on the third part service (mailchimp) if necessary

        return new Response(undefined, {
          status: 204,
        });
      } else {
        return Response.json(
          { message: "Newsletter introuvable" },
          {
            status: 404,
          },
        );
      }
    } catch (error) {
      return errorResponse(serializeError(error), {
        status: 500,
      });
    }
  });
}
