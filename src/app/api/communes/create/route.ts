import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import { z } from "zod";
import { CommuneType } from "@prisma/client";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z
    .string({ required_error: "Le nom est requis" })
    .min(3, "Le nom est requis")
    .max(100, "La valeur ne peut pas excéder 100 caractères."),
  averagePriceBuiltBuilding: z
    .number({ required_error: "Le prix moyen des immeubles batis est requis." })
    .positive("Une moyenne doit être un nombre positive.")
    .optional(),
  averagePriceUnbuiltBuilding: z
    .number({
      required_error: "Le prix moyen des immeubles non batis est requis.",
    })
    .positive("Une moyenne doit être un nombre positive.")
    .optional(),
  area: z
    .number()
    .positive("Une superficie doit être un nombre positive.")
    .optional(),
  population: z
    .number()
    .positive("Une population doit être un nombre positif.")
    .optional(),
  type: z.enum([CommuneType.ruralCommune, CommuneType.districtMunicipality]),
  departmentCapitalId: z.string(),
  departmentId: z.string({
    required_error: "L'identifiant du departement membre est requise.",
  }),
});

export async function POST(req: Request) {
  return adminMiddleware(req, async (user) => {
    try {
      const bodyPayload = createSchema.parse(await requestJsonBody(req));

      // create the plan
      const commune = await prisma.commune.create({
        data: {
          name: bodyPayload.name,
          averagePriceBuiltBuilding: bodyPayload.averagePriceBuiltBuilding,
          averagePriceUnbuiltBuilding: bodyPayload.averagePriceUnbuiltBuilding,
          area: bodyPayload.area,
          population: bodyPayload.population,
          type: bodyPayload.type,
          departmentId: bodyPayload.departmentId,
          departmentCapitalId: bodyPayload.departmentCapitalId,
          updatedAt: new Date(),
        },
      });

      return Response.json(commune);
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
