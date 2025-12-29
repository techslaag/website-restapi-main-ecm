import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { Newsletter } from "@prisma/client";
import { serializeError } from "serialize-error";
import slugify from "slugify";
import { z } from "zod";

export const dynamic = "force-dynamic";

// validation schema
const schema = z.object({
  slug: z.string().optional().nullable(),
  name: z.string({
    required_error: "Le titre de la newsletter est obligatoire",
  }),
  description: z.string({
    required_error: "La description de la newsletter est obligatoire",
  }),
  mailchimpAudienceId: z.string({
    required_error: "L'audience Mailchimp est obligatoire",
  }),
});

export async function POST(request: Request) {
  return adminMiddleware(request, async () => {
    try {
      // register information
      const payload = schema.parse(await requestJsonBody(request));

      // generate the slug of the newsletter
      const slug = payload.slug
        ? slugify(payload.slug.toLowerCase())
        : slugify(payload.name.toLowerCase());

      // check existance
      const exists = await prisma.newsletter.findMany({
        where: { OR: [{ slug: slug }, { slug: { startsWith: slug } }] },
      });

      // newsletter instance
      let newsletter: Newsletter | null = null;

      if (exists.length === 0) {
        newsletter = await prisma.newsletter.create({
          data: {
            name: payload.name,
            description: payload.description,
            mailchimpAudienceId: payload.mailchimpAudienceId,
            slug,
          },
        });
      } else {
        newsletter = await prisma.newsletter.create({
          data: {
            name: payload.name,
            description: payload.description,
            mailchimpAudienceId: payload.mailchimpAudienceId,
            slug: `${slug}-${exists.length}`,
          },
        });
      }

      return Response.json(newsletter, {
        status: 201,
      });
    } catch (error) {
      return errorResponse(serializeError(error), {
        status: 500,
      });
    }
  });
}
