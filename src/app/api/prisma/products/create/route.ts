import adminMiddleware from "@/lib/auth/adminMiddleware";
import { errorResponse } from "@/lib/utils";
import { serializeError } from "serialize-error";
// import products from "@/lib/sample-datas/testing/products.json";
import prisma from "@/lib/prisma";
import {
  FoodAdditives,
  FoodMainClass,
  FoodNutritionalClass,
  FoodOriginAndTreatment,
  FoodSpecialClass,
} from "@prisma/client";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const loadProducts = async () => {
    const productsPath = `${process.env.BULK_DATA_PREFFIX}/products.json`;
    const data = await fs.promises.readFile(productsPath, "utf8");
    return JSON.parse(data);
  };

  // Usage:
  const products = await loadProducts();
  return adminMiddleware(req, async (user) => {
    try {
      let dones = [];
      for (const payload of products) {
        if (payload !== undefined) {
          if (
            payload.mainClass &&
            payload.additives &&
            payload.nutritionalClass &&
            payload.originAndTreatment &&
            payload.specialClass
          ) {
            const energies = await prisma.product.create({
              data: {
                name: payload.name,
                description: payload.description,
                unitOfMeasurementId: payload.unitOfMeasurementId,
                mainClass:
                  payload.mainClass === "DairyProducts"
                    ? FoodMainClass.DairyProducts
                    : payload.mainClass === "FatsAndOils"
                      ? FoodMainClass.FatsAndOils
                      : payload.mainClass === "ConsumerIceCream"
                        ? FoodMainClass.ConsumerIceCream
                        : payload.mainClass === "FruitsAndVegetables"
                          ? FoodMainClass.FruitsAndVegetables
                          : payload.mainClass === "Confectionery"
                            ? FoodMainClass.Confectionery
                            : payload.mainClass ===
                                "CerealsAndCerealBasedProducts"
                              ? FoodMainClass.CerealsAndCerealBasedProducts
                              : payload.mainClass === "BakeryProducts"
                                ? FoodMainClass.BakeryProducts
                                : payload.mainClass === "MeatAndMeatProducts"
                                  ? FoodMainClass.MeatAndMeatProducts
                                  : payload.mainClass ===
                                      "FishAndFisheryProducts"
                                    ? FoodMainClass.FishAndFisheryProducts
                                    : payload.mainClass === "EggsAndEggProducts"
                                      ? FoodMainClass.EggsAndEggProducts
                                      : payload.mainClass === "Sweeteners"
                                        ? FoodMainClass.Sweeteners
                                        : payload.mainClass ===
                                            "SaltSpicesSoupsSauces"
                                          ? FoodMainClass.SaltSpicesSoupsSauces
                                          : payload.mainClass === "Salads"
                                            ? FoodMainClass.Salads
                                            : payload.mainClass ===
                                                "FoodsIntendedForSpecialDiets"
                                              ? FoodMainClass.FoodsIntendedForSpecialDiets
                                              : FoodMainClass.Beverages,
                additives:
                  payload.additives === "FoodsColors"
                    ? FoodAdditives.FoodsColors
                    : payload.additives === "Preservatives"
                      ? FoodAdditives.Preservatives
                      : payload.additives === "AntioxidantsAndAcidityRegulators"
                        ? FoodAdditives.AntioxidantsAndAcidityRegulators
                        : payload.additives === "TextureAgents"
                          ? FoodAdditives.TextureAgents
                          : payload.additives === "EmulsifiersAndStabilizers"
                            ? FoodAdditives.EmulsifiersAndStabilizers
                            : payload.additives === "FlavorEnhancers"
                              ? FoodAdditives.FlavorEnhancers
                              : FoodAdditives.Miscellaneous,
                originAndTreatment:
                  payload.originAndTreatment === "ProductsAnimal"
                    ? FoodOriginAndTreatment.ProductsAnimal
                    : payload.originAndTreatment === "ProductsPlant"
                      ? FoodOriginAndTreatment.ProductsPlant
                      : payload.originAndTreatment === "ProcessedProducts"
                        ? FoodOriginAndTreatment.ProcessedProducts
                        : payload.originAndTreatment === "Beverages"
                          ? FoodOriginAndTreatment.Beverages
                          : FoodOriginAndTreatment.GroceryProducts,
                nutritionalClass:
                  payload.nutritionalClass === "Proteins"
                    ? FoodNutritionalClass.Proteins
                    : payload.nutritionalClass === "Carbohydrates"
                      ? FoodNutritionalClass.Carbohydrates
                      : payload.nutritionalClass === "Fat"
                        ? FoodNutritionalClass.Fat
                        : FoodNutritionalClass.VitaminsAndMinerals,
                specialClass:
                  payload.specialClass === "Organic"
                    ? FoodSpecialClass.Organic
                    : payload.specialClass === "GlutenFree"
                      ? FoodSpecialClass.GlutenFree
                      : payload.specialClass === "VegetarianVegan"
                        ? FoodSpecialClass.VegetarianVegan
                        : payload.specialClass === "FunctionalFortified"
                          ? FoodSpecialClass.FunctionalFortified
                          : FoodSpecialClass.Organic,
                updatedAt: new Date(),
              },
            });
            dones.push(energies);
          } else if (
            payload.mainClass &&
            payload.additives &&
            payload.nutritionalClass &&
            payload.originAndTreatment
          ) {
            const energies = await prisma.product.create({
              data: {
                name: payload.name,
                description: payload.description,
                unitOfMeasurementId: payload.unitOfMeasurementId,
                mainClass:
                  payload.mainClass === "DairyProducts"
                    ? FoodMainClass.DairyProducts
                    : payload.mainClass === "FatsAndOils"
                      ? FoodMainClass.FatsAndOils
                      : payload.mainClass === "ConsumerIceCream"
                        ? FoodMainClass.ConsumerIceCream
                        : payload.mainClass === "FruitsAndVegetables"
                          ? FoodMainClass.FruitsAndVegetables
                          : payload.mainClass === "Confectionery"
                            ? FoodMainClass.Confectionery
                            : payload.mainClass ===
                                "CerealsAndCerealBasedProducts"
                              ? FoodMainClass.CerealsAndCerealBasedProducts
                              : payload.mainClass === "BakeryProducts"
                                ? FoodMainClass.BakeryProducts
                                : payload.mainClass === "MeatAndMeatProducts"
                                  ? FoodMainClass.MeatAndMeatProducts
                                  : payload.mainClass ===
                                      "FishAndFisheryProducts"
                                    ? FoodMainClass.FishAndFisheryProducts
                                    : payload.mainClass === "EggsAndEggProducts"
                                      ? FoodMainClass.EggsAndEggProducts
                                      : payload.mainClass === "Sweeteners"
                                        ? FoodMainClass.Sweeteners
                                        : payload.mainClass ===
                                            "SaltSpicesSoupsSauces"
                                          ? FoodMainClass.SaltSpicesSoupsSauces
                                          : payload.mainClass === "Salads"
                                            ? FoodMainClass.Salads
                                            : payload.mainClass ===
                                                "FoodsIntendedForSpecialDiets"
                                              ? FoodMainClass.FoodsIntendedForSpecialDiets
                                              : FoodMainClass.Beverages,
                additives:
                  payload.additives === "FoodsColors"
                    ? FoodAdditives.FoodsColors
                    : payload.additives === "Preservatives"
                      ? FoodAdditives.Preservatives
                      : payload.additives === "AntioxidantsAndAcidityRegulators"
                        ? FoodAdditives.AntioxidantsAndAcidityRegulators
                        : payload.additives === "TextureAgents"
                          ? FoodAdditives.TextureAgents
                          : payload.additives === "EmulsifiersAndStabilizers"
                            ? FoodAdditives.EmulsifiersAndStabilizers
                            : payload.additives === "FlavorEnhancers"
                              ? FoodAdditives.FlavorEnhancers
                              : FoodAdditives.Miscellaneous,
                originAndTreatment:
                  payload.originAndTreatment === "ProductsAnimal"
                    ? FoodOriginAndTreatment.ProductsAnimal
                    : payload.originAndTreatment === "ProductsPlant"
                      ? FoodOriginAndTreatment.ProductsPlant
                      : payload.originAndTreatment === "ProcessedProducts"
                        ? FoodOriginAndTreatment.ProcessedProducts
                        : payload.originAndTreatment === "Beverages"
                          ? FoodOriginAndTreatment.Beverages
                          : FoodOriginAndTreatment.GroceryProducts,
                nutritionalClass:
                  payload.nutritionalClass === "Proteins"
                    ? FoodNutritionalClass.Proteins
                    : payload.nutritionalClass === "Carbohydrates"
                      ? FoodNutritionalClass.Carbohydrates
                      : payload.nutritionalClass === "Fat"
                        ? FoodNutritionalClass.Fat
                        : FoodNutritionalClass.VitaminsAndMinerals,
                updatedAt: new Date(),
              },
            });
            dones.push(energies);
          } else if (
            payload.mainClass &&
            payload.additives &&
            payload.nutritionalClass &&
            payload.specialClass
          ) {
            const energies = await prisma.product.create({
              data: {
                name: payload.name,
                description: payload.description,
                unitOfMeasurementId: payload.unitOfMeasurementId,
                mainClass:
                  payload.mainClass === "DairyProducts"
                    ? FoodMainClass.DairyProducts
                    : payload.mainClass === "FatsAndOils"
                      ? FoodMainClass.FatsAndOils
                      : payload.mainClass === "ConsumerIceCream"
                        ? FoodMainClass.ConsumerIceCream
                        : payload.mainClass === "FruitsAndVegetables"
                          ? FoodMainClass.FruitsAndVegetables
                          : payload.mainClass === "Confectionery"
                            ? FoodMainClass.Confectionery
                            : payload.mainClass ===
                                "CerealsAndCerealBasedProducts"
                              ? FoodMainClass.CerealsAndCerealBasedProducts
                              : payload.mainClass === "BakeryProducts"
                                ? FoodMainClass.BakeryProducts
                                : payload.mainClass === "MeatAndMeatProducts"
                                  ? FoodMainClass.MeatAndMeatProducts
                                  : payload.mainClass ===
                                      "FishAndFisheryProducts"
                                    ? FoodMainClass.FishAndFisheryProducts
                                    : payload.mainClass === "EggsAndEggProducts"
                                      ? FoodMainClass.EggsAndEggProducts
                                      : payload.mainClass === "Sweeteners"
                                        ? FoodMainClass.Sweeteners
                                        : payload.mainClass ===
                                            "SaltSpicesSoupsSauces"
                                          ? FoodMainClass.SaltSpicesSoupsSauces
                                          : payload.mainClass === "Salads"
                                            ? FoodMainClass.Salads
                                            : payload.mainClass ===
                                                "FoodsIntendedForSpecialDiets"
                                              ? FoodMainClass.FoodsIntendedForSpecialDiets
                                              : FoodMainClass.Beverages,
                additives:
                  payload.additives === "FoodsColors"
                    ? FoodAdditives.FoodsColors
                    : payload.additives === "Preservatives"
                      ? FoodAdditives.Preservatives
                      : payload.additives === "AntioxidantsAndAcidityRegulators"
                        ? FoodAdditives.AntioxidantsAndAcidityRegulators
                        : payload.additives === "TextureAgents"
                          ? FoodAdditives.TextureAgents
                          : payload.additives === "EmulsifiersAndStabilizers"
                            ? FoodAdditives.EmulsifiersAndStabilizers
                            : payload.additives === "FlavorEnhancers"
                              ? FoodAdditives.FlavorEnhancers
                              : FoodAdditives.Miscellaneous,
                nutritionalClass:
                  payload.nutritionalClass === "Proteins"
                    ? FoodNutritionalClass.Proteins
                    : payload.nutritionalClass === "Carbohydrates"
                      ? FoodNutritionalClass.Carbohydrates
                      : payload.nutritionalClass === "Fat"
                        ? FoodNutritionalClass.Fat
                        : FoodNutritionalClass.VitaminsAndMinerals,
                specialClass:
                  payload.specialClass === "Organic"
                    ? FoodSpecialClass.Organic
                    : payload.specialClass === "GlutenFree"
                      ? FoodSpecialClass.GlutenFree
                      : payload.specialClass === "VegetarianVegan"
                        ? FoodSpecialClass.VegetarianVegan
                        : payload.specialClass === "FunctionalFortified"
                          ? FoodSpecialClass.FunctionalFortified
                          : FoodSpecialClass.Organic,
                updatedAt: new Date(),
              },
            });
            dones.push(energies);
          } else if (
            payload.mainClass &&
            payload.additives &&
            payload.nutritionalClass
          ) {
            const energies = await prisma.product.create({
              data: {
                name: payload.name,
                description: payload.description,
                unitOfMeasurementId: payload.unitOfMeasurementId,
                mainClass:
                  payload.mainClass === "DairyProducts"
                    ? FoodMainClass.DairyProducts
                    : payload.mainClass === "FatsAndOils"
                      ? FoodMainClass.FatsAndOils
                      : payload.mainClass === "ConsumerIceCream"
                        ? FoodMainClass.ConsumerIceCream
                        : payload.mainClass === "FruitsAndVegetables"
                          ? FoodMainClass.FruitsAndVegetables
                          : payload.mainClass === "Confectionery"
                            ? FoodMainClass.Confectionery
                            : payload.mainClass ===
                                "CerealsAndCerealBasedProducts"
                              ? FoodMainClass.CerealsAndCerealBasedProducts
                              : payload.mainClass === "BakeryProducts"
                                ? FoodMainClass.BakeryProducts
                                : payload.mainClass === "MeatAndMeatProducts"
                                  ? FoodMainClass.MeatAndMeatProducts
                                  : payload.mainClass ===
                                      "FishAndFisheryProducts"
                                    ? FoodMainClass.FishAndFisheryProducts
                                    : payload.mainClass === "EggsAndEggProducts"
                                      ? FoodMainClass.EggsAndEggProducts
                                      : payload.mainClass === "Sweeteners"
                                        ? FoodMainClass.Sweeteners
                                        : payload.mainClass ===
                                            "SaltSpicesSoupsSauces"
                                          ? FoodMainClass.SaltSpicesSoupsSauces
                                          : payload.mainClass === "Salads"
                                            ? FoodMainClass.Salads
                                            : payload.mainClass ===
                                                "FoodsIntendedForSpecialDiets"
                                              ? FoodMainClass.FoodsIntendedForSpecialDiets
                                              : FoodMainClass.Beverages,
                additives:
                  payload.additives === "FoodsColors"
                    ? FoodAdditives.FoodsColors
                    : payload.additives === "Preservatives"
                      ? FoodAdditives.Preservatives
                      : payload.additives === "AntioxidantsAndAcidityRegulators"
                        ? FoodAdditives.AntioxidantsAndAcidityRegulators
                        : payload.additives === "TextureAgents"
                          ? FoodAdditives.TextureAgents
                          : payload.additives === "EmulsifiersAndStabilizers"
                            ? FoodAdditives.EmulsifiersAndStabilizers
                            : payload.additives === "FlavorEnhancers"
                              ? FoodAdditives.FlavorEnhancers
                              : FoodAdditives.Miscellaneous,
                nutritionalClass:
                  payload.nutritionalClass === "Proteins"
                    ? FoodNutritionalClass.Proteins
                    : payload.nutritionalClass === "Carbohydrates"
                      ? FoodNutritionalClass.Carbohydrates
                      : payload.nutritionalClass === "Fat"
                        ? FoodNutritionalClass.Fat
                        : FoodNutritionalClass.VitaminsAndMinerals,
                updatedAt: new Date(),
              },
            });
            dones.push(energies);
          } else if (
            payload.mainClass &&
            payload.originAndTreatment &&
            payload.nutritionalClass
          ) {
            const energies = await prisma.product.create({
              data: {
                name: payload.name,
                description: payload.description,
                unitOfMeasurementId: payload.unitOfMeasurementId,
                mainClass:
                  payload.mainClass === "DairyProducts"
                    ? FoodMainClass.DairyProducts
                    : payload.mainClass === "FatsAndOils"
                      ? FoodMainClass.FatsAndOils
                      : payload.mainClass === "ConsumerIceCream"
                        ? FoodMainClass.ConsumerIceCream
                        : payload.mainClass === "FruitsAndVegetables"
                          ? FoodMainClass.FruitsAndVegetables
                          : payload.mainClass === "Confectionery"
                            ? FoodMainClass.Confectionery
                            : payload.mainClass ===
                                "CerealsAndCerealBasedProducts"
                              ? FoodMainClass.CerealsAndCerealBasedProducts
                              : payload.mainClass === "BakeryProducts"
                                ? FoodMainClass.BakeryProducts
                                : payload.mainClass === "MeatAndMeatProducts"
                                  ? FoodMainClass.MeatAndMeatProducts
                                  : payload.mainClass ===
                                      "FishAndFisheryProducts"
                                    ? FoodMainClass.FishAndFisheryProducts
                                    : payload.mainClass === "EggsAndEggProducts"
                                      ? FoodMainClass.EggsAndEggProducts
                                      : payload.mainClass === "Sweeteners"
                                        ? FoodMainClass.Sweeteners
                                        : payload.mainClass ===
                                            "SaltSpicesSoupsSauces"
                                          ? FoodMainClass.SaltSpicesSoupsSauces
                                          : payload.mainClass === "Salads"
                                            ? FoodMainClass.Salads
                                            : payload.mainClass ===
                                                "FoodsIntendedForSpecialDiets"
                                              ? FoodMainClass.FoodsIntendedForSpecialDiets
                                              : FoodMainClass.Beverages,
                originAndTreatment:
                  payload.originAndTreatment === "ProductsAnimal"
                    ? FoodOriginAndTreatment.ProductsAnimal
                    : payload.originAndTreatment === "ProductsPlant"
                      ? FoodOriginAndTreatment.ProductsPlant
                      : payload.originAndTreatment === "ProcessedProducts"
                        ? FoodOriginAndTreatment.ProcessedProducts
                        : payload.originAndTreatment === "Beverages"
                          ? FoodOriginAndTreatment.Beverages
                          : FoodOriginAndTreatment.GroceryProducts,
                nutritionalClass:
                  payload.nutritionalClass === "Proteins"
                    ? FoodNutritionalClass.Proteins
                    : payload.nutritionalClass === "Carbohydrates"
                      ? FoodNutritionalClass.Carbohydrates
                      : payload.nutritionalClass === "Fat"
                        ? FoodNutritionalClass.Fat
                        : FoodNutritionalClass.VitaminsAndMinerals,
                updatedAt: new Date(),
              },
            });
            dones.push(energies);
          } else if (
            payload.mainClass &&
            payload.nutritionalClass &&
            payload.specialClass
          ) {
            const energies = await prisma.product.create({
              data: {
                name: payload.name,
                description: payload.description,
                unitOfMeasurementId: payload.unitOfMeasurementId,
                mainClass:
                  payload.mainClass === "DairyProducts"
                    ? FoodMainClass.DairyProducts
                    : payload.mainClass === "FatsAndOils"
                      ? FoodMainClass.FatsAndOils
                      : payload.mainClass === "ConsumerIceCream"
                        ? FoodMainClass.ConsumerIceCream
                        : payload.mainClass === "FruitsAndVegetables"
                          ? FoodMainClass.FruitsAndVegetables
                          : payload.mainClass === "Confectionery"
                            ? FoodMainClass.Confectionery
                            : payload.mainClass ===
                                "CerealsAndCerealBasedProducts"
                              ? FoodMainClass.CerealsAndCerealBasedProducts
                              : payload.mainClass === "BakeryProducts"
                                ? FoodMainClass.BakeryProducts
                                : payload.mainClass === "MeatAndMeatProducts"
                                  ? FoodMainClass.MeatAndMeatProducts
                                  : payload.mainClass ===
                                      "FishAndFisheryProducts"
                                    ? FoodMainClass.FishAndFisheryProducts
                                    : payload.mainClass === "EggsAndEggProducts"
                                      ? FoodMainClass.EggsAndEggProducts
                                      : payload.mainClass === "Sweeteners"
                                        ? FoodMainClass.Sweeteners
                                        : payload.mainClass ===
                                            "SaltSpicesSoupsSauces"
                                          ? FoodMainClass.SaltSpicesSoupsSauces
                                          : payload.mainClass === "Salads"
                                            ? FoodMainClass.Salads
                                            : payload.mainClass ===
                                                "FoodsIntendedForSpecialDiets"
                                              ? FoodMainClass.FoodsIntendedForSpecialDiets
                                              : FoodMainClass.Beverages,
                nutritionalClass:
                  payload.nutritionalClass === "Proteins"
                    ? FoodNutritionalClass.Proteins
                    : payload.nutritionalClass === "Carbohydrates"
                      ? FoodNutritionalClass.Carbohydrates
                      : payload.nutritionalClass === "Fat"
                        ? FoodNutritionalClass.Fat
                        : FoodNutritionalClass.VitaminsAndMinerals,
                specialClass:
                  payload.specialClass === "Organic"
                    ? FoodSpecialClass.Organic
                    : payload.specialClass === "GlutenFree"
                      ? FoodSpecialClass.GlutenFree
                      : payload.specialClass === "VegetarianVegan"
                        ? FoodSpecialClass.VegetarianVegan
                        : payload.specialClass === "FunctionalFortified"
                          ? FoodSpecialClass.FunctionalFortified
                          : FoodSpecialClass.Organic,
                updatedAt: new Date(),
              },
            });
            dones.push(energies);
          } else if (payload.mainClass && payload.nutritionalClass) {
            const energies = await prisma.product.create({
              data: {
                name: payload.name,
                description: payload.description,
                unitOfMeasurementId: payload.unitOfMeasurementId,
                mainClass:
                  payload.mainClass === "DairyProducts"
                    ? FoodMainClass.DairyProducts
                    : payload.mainClass === "FatsAndOils"
                      ? FoodMainClass.FatsAndOils
                      : payload.mainClass === "ConsumerIceCream"
                        ? FoodMainClass.ConsumerIceCream
                        : payload.mainClass === "FruitsAndVegetables"
                          ? FoodMainClass.FruitsAndVegetables
                          : payload.mainClass === "Confectionery"
                            ? FoodMainClass.Confectionery
                            : payload.mainClass ===
                                "CerealsAndCerealBasedProducts"
                              ? FoodMainClass.CerealsAndCerealBasedProducts
                              : payload.mainClass === "BakeryProducts"
                                ? FoodMainClass.BakeryProducts
                                : payload.mainClass === "MeatAndMeatProducts"
                                  ? FoodMainClass.MeatAndMeatProducts
                                  : payload.mainClass ===
                                      "FishAndFisheryProducts"
                                    ? FoodMainClass.FishAndFisheryProducts
                                    : payload.mainClass === "EggsAndEggProducts"
                                      ? FoodMainClass.EggsAndEggProducts
                                      : payload.mainClass === "Sweeteners"
                                        ? FoodMainClass.Sweeteners
                                        : payload.mainClass ===
                                            "SaltSpicesSoupsSauces"
                                          ? FoodMainClass.SaltSpicesSoupsSauces
                                          : payload.mainClass === "Salads"
                                            ? FoodMainClass.Salads
                                            : payload.mainClass ===
                                                "FoodsIntendedForSpecialDiets"
                                              ? FoodMainClass.FoodsIntendedForSpecialDiets
                                              : FoodMainClass.Beverages,
                nutritionalClass:
                  payload.nutritionalClass === "Proteins"
                    ? FoodNutritionalClass.Proteins
                    : payload.nutritionalClass === "Carbohydrates"
                      ? FoodNutritionalClass.Carbohydrates
                      : payload.nutritionalClass === "Fat"
                        ? FoodNutritionalClass.Fat
                        : FoodNutritionalClass.VitaminsAndMinerals,
                updatedAt: new Date(),
              },
            });
            dones.push(energies);
          }
        }
      }
      return Response.json(dones);
    } catch (err) {
      return errorResponse(serializeError(err), { status: 500 });
    }
  });
}
