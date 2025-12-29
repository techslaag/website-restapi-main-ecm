import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse, requestJsonBody } from "@/lib/utils";
import { serializeError } from "serialize-error";
import { z } from "zod";
import { $Enums, Currency } from "@prisma/client";
import Avalaibility = $Enums.Avalaibility;

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    productId: z.string({
      required_error: "La reference produit auquel il appartient est requise.",
    }),
    cityId: z.string({
      required_error: "La ville dans laquelle le produit est pricé est requis.",
    }),
    price: z
      .number({
        required_error: "Le prix du produit dans cette ville est requis",
      })
      .positive("Le prix d'un produit doit être un nombre positif."),
    currency: z.enum([
      Currency.xaf,
      Currency.usd,
      Currency.xof,
      Currency.eur,
      Currency.gbp,
    ]),
    avalaibility: z.enum([Avalaibility.Avalaible, Avalaibility.Unavalaible]),
    productCityOnPriceCityId: z.string().optional(),
    productCityOnPriceProductId: z.string().optional(),
    entryDate: z.date({
      required_error: "La date d'enregistrement est requise",
    }),
  })
  .refine(
    (data) => {
      if (data.productCityOnPriceCityId) {
        return data.productCityOnPriceProductId !== undefined;
      }
      return true; // Si productCityOnPriceCityId est vide, la validation passe
    },
    {
      message:
        "Le champ productCityOnPriceProductId est requis lorsque le champ productCityOnPriceCityId a une valeur",
    },
  );

export async function POST(req: Request) {
  return adminMiddleware(req, async (user) => {
    try {
      const bodyPayload = createSchema.parse(await requestJsonBody(req));

      let productInCity;
      if (bodyPayload.productCityOnPriceCityId) {
        // create the productInCity
        productInCity = await prisma.productInCity.create({
          data: {
            cityId: bodyPayload.cityId,
            productId: bodyPayload.productId,
            price: bodyPayload.price,
            currency: bodyPayload.currency,
            avalaibility: bodyPayload.avalaibility,
            productCityOnPriceCityId: bodyPayload.productCityOnPriceCityId,
            productCityOnPriceProductId:
              bodyPayload.productCityOnPriceProductId,
            entryDate: bodyPayload.entryDate,
            updatedAt: new Date(),
          },
        });
      } else {
        // create the productInCity
        productInCity = await prisma.productInCity.create({
          data: {
            cityId: bodyPayload.cityId,
            productId: bodyPayload.productId,
            price: bodyPayload.price,
            currency: bodyPayload.currency,
            avalaibility: bodyPayload.avalaibility,
            entryDate: bodyPayload.entryDate,
            updatedAt: new Date(),
          },
        });
      }

      return Response.json(productInCity);
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
