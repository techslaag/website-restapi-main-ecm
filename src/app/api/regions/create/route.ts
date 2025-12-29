import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z
    .string({ required_error: "Le nom est requis" })
    .min(3, "Le nom est requis")
    .max(100, "La valeur ne peut pas excéder 100 caractères."),
  area: z.number().positive("Une superficie doit être un nombre positive."),
  population: z
    .number()
    .positive("Une population doit être un nombre positif."),
  countryId: z.string({ required_error: "L'identifiant du pays est requise." }),
});

export async function POST(req: Request) {
  return adminMiddleware(req, async (user) => {
    try {
      const bodyPayload = createSchema.parse(await requestJsonBody(req));

      // create the plan
      const region = await prisma.region.create({
        data: {
          name: bodyPayload.name,
          area: bodyPayload.area,
          population: bodyPayload.population,
          countryId: bodyPayload.countryId,
          updatedAt: new Date(),
        },
      });

      return Response.json(region);
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
