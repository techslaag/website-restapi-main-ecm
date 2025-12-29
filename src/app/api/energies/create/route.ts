import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import { z } from "zod";
import { Currency, MeasurementType } from "@prisma/client";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z
    .string({ required_error: "Le nom est requis" })
    .min(5, "Le nom est requis")
    .max(100, "La valeur ne peut pas excéder 100 caractères."),
  price: z.number({ required_error: "Le prix est requis" }).positive(),
  currency: z.enum([Currency.eur, Currency.eur, Currency.xof, Currency.xaf]),
  measurementId: z.string({
    required_error: "L'identifiant de l'unité de mesure est requise.",
  }),
  successorId: z.string().optional(),
  countryId: z.string(),
});

export async function POST(req: Request) {
  return adminMiddleware(req, async (user) => {
    try {
      const bodyPayload = createSchema.parse(await requestJsonBody(req));

      if (bodyPayload.successorId) {
        // create the plan
        const energy = await prisma.energy.create({
          data: {
            name: bodyPayload.name,
            price: bodyPayload.price,
            currency: bodyPayload.currency,
            measurementId: bodyPayload.measurementId,
            successorId: bodyPayload.successorId,
            countryId: bodyPayload.countryId,
            updatedAt: new Date(),
          },
        });
        return Response.json(energy);
      } else {
        // create the plan
        const energy = await prisma.energy.create({
          data: {
            name: bodyPayload.name,
            price: bodyPayload.price,
            currency: bodyPayload.currency,
            measurementId: bodyPayload.measurementId,
            countryId: bodyPayload.countryId,
            updatedAt: new Date(),
          },
        });
        return Response.json(energy);
      }
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
