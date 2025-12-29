import {
  Decimal,
  DefaultArgs,
  GetFindResult,
} from "@prisma/client/runtime/binary";
import ICommune, { toICommune } from "@/interfaces/ICommune";
import {
  Avalaibility,
  Commune,
  Country,
  Department,
  Measurement,
  Prisma,
  Product,
  ProductInCity,
  Region,
} from "@prisma/client";
import IProductFM, { toIProductFM } from "@/interfaces/IProductFM";

export default interface IProductsInCities {
  productId: string;
  cityId: string;
  price: Decimal;
  currency: "usd" | "gbp" | "eur" | "xaf" | "xof";
  avalaibility: "Disponible" | "Indisponible";
  createdAt: Date;
  updatedAt: Date | null;
  productCityOnPriceCityId: string | null;
  productCityOnPriceProductId: string | null;
  entryDate: Date;
  // successor?: IProductsInCities;
  // predecessor?: IProductsInCities;
  product?: IProductFM;
  city?: ICommune;
}

export function toIProductsInCities(
  // item: GetFindResult<
  //   Prisma.$ProductInCityPayload<DefaultArgs>,
  //   {
  //     take: number;
  //     include: {
  //       product?: {
  //         include?: {
  //           unitOfMeasurement?: boolean;
  //         };
  //       };
  //       successor?: boolean;
  //       city?: {
  //         include: {
  //           department: {
  //             include: {
  //               communes: boolean;
  //               region: {
  //                 include: { country: boolean; departments: boolean };
  //               };
  //             };
  //           };
  //         };
  //       };
  //       predecessor?: boolean;
  //     };
  //     orderBy: { productId: string };
  //     where: Prisma.ProductInCityWhereInput;
  //     skip: number;
  //   }
  // >,
  item: Pick<
    ProductInCity,
    | "cityId"
    | "productId"
    | "productCityOnPriceProductId"
    | "productCityOnPriceCityId"
    | "price"
    | "currency"
    | "avalaibility"
    | "createdAt"
    | "updatedAt"
    | "entryDate"
  > & {
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
  },
): IProductsInCities {
  return {
    productId: item.productId,
    cityId: item.cityId,
    price: item.price,
    currency: item.currency,
    avalaibility:
      item.avalaibility === Avalaibility.Avalaible
        ? "Disponible"
        : "Indisponible",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    productCityOnPriceCityId: item.productCityOnPriceCityId,
    productCityOnPriceProductId: item.productCityOnPriceProductId,
    city: item.city ? toICommune(item.city) : undefined,
    product: item.product ? toIProductFM(item.product) : undefined,
    entryDate: item.entryDate,
    // successor: item.successor ? toIProductsInCities(item.successor) : undefined,
    // predecessor: item.predecessor
    //   ? toIProductsInCities(item.predecessor)
    //   : undefined,
  };
}
