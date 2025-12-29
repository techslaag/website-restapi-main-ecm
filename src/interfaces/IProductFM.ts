import IMeasurement, { toIMeasurement } from "@/interfaces/IMeasurement";
import {
  Avalaibility,
  Commune,
  Country,
  Department,
  Measurement,
  Product,
  ProductInCity,
  Region,
} from "@prisma/client";
import IProductsInCities, {
  toIProductsInCities,
} from "@/interfaces/IProductsInCities";

export default interface IProductFM {
  id: string;
  name: string;
  description: string;
  unitOfMeasurement: IMeasurement;
  avalaibility?: string;
  mainClass:
    | "Produits laitiers"
    | "Matières grasses et huiles"
    | "Glaces de consommation"
    | "Fruits et légumes"
    | "Confiserie"
    | "Céréales et produits à base de céréales"
    | "Produits de boulangerie"
    | "Viande et produits carnés"
    | "Poisson et produits de la pêche"
    | "Œufs et produits à base d'œufs"
    | "Édulcorants"
    | "Sels, épices, potages, sauces"
    | "salades"
    | "Aliments destinés à une alimentation particulière"
    | "Boissons";
  additives:
    | "Colorants (E100-E199)"
    | "Conservateurs (E200-E299)"
    | "Antioxydants et régulateurs d'acidité (E300-E399)"
    | "Agents de texture (E400-E499)"
    | "Émulsifiants et stabilisants (E500-E599)"
    | "Exhausteurs de goût (E600-E699)"
    | "Divers (E900-E999)"
    | null;
  originAndTreatment:
    | "Produits d'origine animale"
    | "Produits d'origine végétale"
    | "Produits transformés"
    | "Boissons"
    | "Produits d'épicerie"
    | null;
  nutritionalClass:
    | "Protéines"
    | "Glucides"
    | "Lipides"
    | "Vitamines et minéraux";
  specialClass:
    | "Aliments biologiques"
    | "Aliments sans gluten"
    | "Aliments végétariens/végans"
    | "Aliments fonctionnels ou enrichis"
    | null;
  pricePerCities?: IProductsInCities[];
}

export function toIProductFM(
  item: Pick<
    Product,
    | "id"
    | "name"
    | "description"
    | "mainClass"
    | "nutritionalClass"
    | "additives"
    | "originAndTreatment"
    | "specialClass"
  > & {
    unitOfMeasurement: Pick<
      Measurement,
      "id" | "name" | "notation" | "type" | "createdAt" | "updatedAt"
    >;
    communeOnPrice?: Pick<
      ProductInCity,
      | "productId"
      | "cityId"
      | "avalaibility"
      | "currency"
      | "price"
      | "productCityOnPriceCityId"
      | "productCityOnPriceProductId"
      | "createdAt"
      | "updatedAt"
      | "entryDate"
    >[] & {
      city?: Pick<
        Commune,
        | "id"
        | "name"
        | "area"
        | "population"
        | "averagePriceBuiltBuilding"
        | "averagePriceUnbuiltBuilding"
        | "type"
        | "departmentId"
        | "departmentCapitalId"
        | "createdAt"
        | "updatedAt"
      > & {
        department?: Pick<
          Department,
          | "id"
          | "name"
          | "area"
          | "population"
          | "averagePriceBuiltBuilding"
          | "averagePriceUnbuiltBuilding"
          | "regionId"
          | "regionCapitalId"
          | "createdAt"
          | "updatedAt"
        > & {
          region: Pick<
            Region,
            | "id"
            | "name"
            | "area"
            | "population"
            | "countryId"
            | "createdAt"
            | "updatedAt"
          > & {
            country: Pick<
              Country,
              | "id"
              | "countryName"
              | "isoCode2"
              | "isoCode3"
              | "numericCode"
              | "capital"
              | "population"
              | "area"
              | "currencyCode"
              | "officialLanguage"
              | "continent"
              | "timeZone"
              | "callingCode"
              | "internetTLD"
              | "gdp"
              | "hdi"
              | "createdAt"
              | "updatedAt"
            >;
            departments: Pick<
              Department,
              | "id"
              | "name"
              | "area"
              | "population"
              | "averagePriceBuiltBuilding"
              | "averagePriceUnbuiltBuilding"
              | "regionId"
              | "regionCapitalId"
              | "createdAt"
              | "updatedAt"
            >[];
          };
          communes: Pick<
            Commune,
            | "id"
            | "name"
            | "area"
            | "population"
            | "averagePriceBuiltBuilding"
            | "averagePriceUnbuiltBuilding"
            | "type"
            | "departmentId"
            | "departmentCapitalId"
            | "createdAt"
            | "updatedAt"
          >[];
        };
      };
      product?: Pick<
        Product,
        | "id"
        | "name"
        | "description"
        | "mainClass"
        | "nutritionalClass"
        | "additives"
        | "originAndTreatment"
        | "specialClass"
        | "createdAt"
        | "updatedAt"
      > & {
        unitOfMeasurement: Pick<
          Measurement,
          "id" | "name" | "notation" | "type" | "createdAt" | "updatedAt"
        >;
      };
    };
  },
): IProductFM {
  const pricePerCities = item.communeOnPrice?.map((item) =>
    toIProductsInCities(item),
  );
  let avalaibility;
  if (pricePerCities) {
    const length = pricePerCities.length;
    let avalaible = 0;
    for (const i of pricePerCities) {
      if (i.avalaibility === "Disponible") {
        avalaible++;
      }
    }
    if (avalaible === length) {
      avalaibility = "Disponible";
    } else if (avalaible === 0) {
      avalaibility = "Indisponible";
    } else {
      avalaibility = "Moyen";
    }
  }
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    unitOfMeasurement: toIMeasurement(item.unitOfMeasurement),
    avalaibility,
    mainClass:
      item.mainClass === "DairyProducts"
        ? "Produits laitiers"
        : item.mainClass === "FatsAndOils"
          ? "Matières grasses et huiles"
          : item.mainClass === "ConsumerIceCream"
            ? "Glaces de consommation"
            : item.mainClass === "FruitsAndVegetables"
              ? "Fruits et légumes"
              : item.mainClass === "Confectionery"
                ? "Confiserie"
                : item.mainClass === "CerealsAndCerealBasedProducts"
                  ? "Céréales et produits à base de céréales"
                  : item.mainClass === "BakeryProducts"
                    ? "Produits de boulangerie"
                    : item.mainClass === "MeatAndMeatProducts"
                      ? "Viande et produits carnés"
                      : item.mainClass === "FishAndFisheryProducts"
                        ? "Poisson et produits de la pêche"
                        : item.mainClass === "EggsAndEggProducts"
                          ? "Œufs et produits à base d'œufs"
                          : item.mainClass === "Sweeteners"
                            ? "Édulcorants"
                            : item.mainClass === "SaltSpicesSoupsSauces"
                              ? "Sels, épices, potages, sauces"
                              : item.mainClass === "Salads"
                                ? "salades"
                                : item.mainClass ===
                                    "FoodsIntendedForSpecialDiets"
                                  ? "Aliments destinés à une alimentation particulière"
                                  : "Boissons",
    additives:
      item.additives === "FoodsColors"
        ? "Colorants (E100-E199)"
        : item.additives === "Preservatives"
          ? "Conservateurs (E200-E299)"
          : item.additives === "AntioxidantsAndAcidityRegulators"
            ? "Antioxydants et régulateurs d'acidité (E300-E399)"
            : item.additives === "TextureAgents"
              ? "Agents de texture (E400-E499)"
              : item.additives === "EmulsifiersAndStabilizers"
                ? "Émulsifiants et stabilisants (E500-E599)"
                : item.additives === "FlavorEnhancers"
                  ? "Exhausteurs de goût (E600-E699)"
                  : "Divers (E900-E999)",
    originAndTreatment:
      item.originAndTreatment === "ProductsAnimal"
        ? "Produits d'origine animale"
        : item.originAndTreatment === "ProductsPlant"
          ? "Produits d'origine végétale"
          : item.originAndTreatment === "ProcessedProducts"
            ? "Produits transformés"
            : item.originAndTreatment === "Beverages"
              ? "Boissons"
              : "Produits d'épicerie",
    nutritionalClass:
      item.nutritionalClass === "Proteins"
        ? "Protéines"
        : item.nutritionalClass === "Carbohydrates"
          ? "Glucides"
          : item.nutritionalClass === "Fat"
            ? "Lipides"
            : "Vitamines et minéraux",
    specialClass:
      item.specialClass === "Organic"
        ? "Aliments biologiques"
        : item.specialClass === "GlutenFree"
          ? "Aliments sans gluten"
          : item.specialClass === "VegetarianVegan"
            ? "Aliments végétariens/végans"
            : "Aliments fonctionnels ou enrichis",
    pricePerCities,
  };
}
