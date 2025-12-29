import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import { z } from "zod";
import {
  FoodAdditives,
  FoodMainClass,
  FoodNutritionalClass,
  FoodOriginAndTreatment,
  FoodSpecialClass,
  MeasurementType,
} from "@prisma/client";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z
    .string({ required_error: "Le nom est requis" })
    .min(5, "Le nom est requis")
    .max(100, "La valeur ne peut pas excéder 100 caractères."),
  description: z
    .string({ required_error: "La description est requise" })
    .max(10, "La valeur ne peut pas excéder 100 caractères."),
  unitOfMeasurementId: z.string({
    required_error: "L'identifiant de l'unité de mesure est requise.",
  }),
  mainClass: z.enum([
    FoodMainClass.DairyProducts,
    FoodMainClass.ConsumerIceCream,
    FoodMainClass.FruitsAndVegetables,
    FoodMainClass.Confectionery,
    FoodMainClass.CerealsAndCerealBasedProducts,
    FoodMainClass.BakeryProducts,
    FoodMainClass.MeatAndMeatProducts,
    FoodMainClass.FishAndFisheryProducts,
    FoodMainClass.EggsAndEggProducts,
    FoodMainClass.Sweeteners,
    FoodMainClass.SaltSpicesSoupsSauces,
    FoodMainClass.Salads,
    FoodMainClass.FoodsIntendedForSpecialDiets,
    FoodMainClass.Beverages,
  ]),
  additives: z
    .enum([
      FoodAdditives.FoodsColors,
      FoodAdditives.Preservatives,
      FoodAdditives.AntioxidantsAndAcidityRegulators,
      FoodAdditives.TextureAgents,
      FoodAdditives.EmulsifiersAndStabilizers,
      FoodAdditives.FlavorEnhancers,
      FoodAdditives.Miscellaneous,
    ])
    .optional(),
  originAndTreatment: z
    .enum([
      FoodOriginAndTreatment.ProductsPlant,
      FoodOriginAndTreatment.ProductsAnimal,
      FoodOriginAndTreatment.ProcessedProducts,
      FoodOriginAndTreatment.Beverages,
      FoodOriginAndTreatment.GroceryProducts,
    ])
    .optional(),
  nutritionalClass: z.enum([
    FoodNutritionalClass.Proteins,
    FoodNutritionalClass.Carbohydrates,
    FoodNutritionalClass.Fat,
    FoodNutritionalClass.VitaminsAndMinerals,
  ]),
  specialClass: z
    .enum([
      FoodSpecialClass.Organic,
      FoodSpecialClass.GlutenFree,
      FoodSpecialClass.VegetarianVegan,
      FoodSpecialClass.FunctionalFortified,
    ])
    .optional(),
});

export async function POST(req: Request) {
  return adminMiddleware(req, async (user) => {
    try {
      const bodyPayload = createSchema.parse(await requestJsonBody(req));

      // create the product
      const product = await prisma.product.create({
        data: {
          name: bodyPayload.name,
          description: bodyPayload.description,
          unitOfMeasurementId: bodyPayload.unitOfMeasurementId,
          mainClass: bodyPayload.mainClass,
          additives: bodyPayload.additives,
          originAndTreatment: bodyPayload.originAndTreatment,
          nutritionalClass: bodyPayload.nutritionalClass,
          specialClass: bodyPayload.specialClass,
          updatedAt: new Date(),
        },
      });

      return Response.json(product);
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
