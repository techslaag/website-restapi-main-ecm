import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import slugify from "slugify";
import { z } from "zod";

export const dynamic = "force-dynamic";

// validation schema
const schema = z.object({
  slug: z.string().optional().nullable(),
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  mailchimpAudienceId: z.string().optional().nullable(),
});

export async function PUT(
  request: Request,
  { params: { id: newsletterId } }: { params: { id: string } },
) {
  return adminMiddleware(request, async () => {
    try {
      // register information
      const payload = schema.parse(await requestJsonBody(request));

      // newsletter instance
      let newsletter = await prisma.newsletter.findUnique({
        where: { id: newsletterId },
      });

      if (newsletter) {
        // generate the slug of the newsletter
        const slug = payload.slug
          ? slugify(payload.slug.toLowerCase())
          : payload.name
            ? slugify(payload.name.toLowerCase())
            : newsletter.slug;

        // check existance
        const exists =
          slug !== newsletter.slug
            ? await prisma.newsletter.findMany({
                where: {
                  slug,
                  OR: [{ slug: { startsWith: slug } }],
                },
              })
            : [];

        if (exists.length < 2) {
          newsletter = await prisma.newsletter.update({
            where: {
              id: newsletter.id,
            },
            data: {
              name: payload.name ?? newsletter.name,
              description:
                payload.description === null
                  ? null
                  : payload.description ?? newsletter.description,
              slug,
              mailchimpAudienceId:
                payload.mailchimpAudienceId === null
                  ? null
                  : payload.mailchimpAudienceId ??
                    newsletter.mailchimpAudienceId,
              updatedAt: new Date(),
            },
          });
        } else {
          newsletter = await prisma.newsletter.update({
            where: {
              id: newsletter.id,
            },
            data: {
              name: payload.name ?? newsletter.name,
              description:
                payload.description === null
                  ? null
                  : payload.description ?? newsletter.description,
              slug: `${slug}-${exists.length}`,
              mailchimpAudienceId:
                payload.mailchimpAudienceId === null
                  ? null
                  : payload.mailchimpAudienceId ??
                    newsletter.mailchimpAudienceId,
              updatedAt: new Date(),
            },
          });
        }

        return Response.json(newsletter, {
          status: 200,
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
