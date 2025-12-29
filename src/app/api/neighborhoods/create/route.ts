import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z
    .string({ required_error: "Le nom est requis" })
    .min(5, "Le nom est requis")
    .max(100, "La valeur ne peut pas excéder 100 caractères."),
  averagePriceBuiltBuilding: z
    .number({ required_error: "Le prix moyen des immeubles batis est requis." })
    .positive("Une moyenne doit être un nombre positive.").optional(),
  averagePriceUnbuiltBuilding: z
    .number({
      required_error: "Le prix moyen des immeubles non batis est requis.",
    })
    .positive("Une moyenne doit être un nombre positive.").optional(),
  area: z.number().positive("Une superficie doit être un nombre positive."),
  population: z
    .number()
    .positive("Une population doit être un nombre positif."),
  communeId: z.string({
    required_error: "L'identifiant du departement membre est requise.",
  }),
  successorId: z.string().optional(),
});

export async function POST(req: Request) {
  return adminMiddleware(req, async (user) => {
    try {
      const bodyPayload = createSchema.parse(await requestJsonBody(req));

      // create the plan
      const neighborhood = await prisma.neighborhood.create({
        data: {
          name: bodyPayload.name,
          averagePriceBuiltBuilding: bodyPayload.averagePriceBuiltBuilding,
          averagePriceUnbuiltBuilding: bodyPayload.averagePriceUnbuiltBuilding,
          area: bodyPayload.area,
          population: bodyPayload.population,
          communeId: bodyPayload.communeId,
          successorId: bodyPayload.successorId,
          updatedAt: new Date(),
        },
      });

      return Response.json(neighborhood);
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
