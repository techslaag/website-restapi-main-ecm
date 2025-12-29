import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import { z } from "zod";
import { MeasurementType } from "@prisma/client";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z
    .string({ required_error: "Le nom est requis" })
    .min(5, "Le nom est requis")
    .max(100, "La valeur ne peut pas excéder 100 caractères."),
  notation: z
    .string({ required_error: "La notation est requise" })
    .max(10, "La valeur ne peut pas excéder 10 caractères."),
  type: z.enum([MeasurementType.Product, MeasurementType.Energy]),
});

export async function POST(req: Request) {
  return adminMiddleware(req, async (user) => {
    try {
      const bodyPayload = createSchema.parse(await requestJsonBody(req));

      // create the measurement
      const measurement = await prisma.measurement.create({
        data: {
          name: bodyPayload.name,
          notation: bodyPayload.notation,
          type: bodyPayload.type,
          updatedAt: new Date(),
        },
      });

      return Response.json(measurement);
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
