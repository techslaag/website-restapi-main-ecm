import { pick } from "next/dist/lib/pick";
import { Country, Department, Prisma, Region } from "@prisma/client";
import { DefaultArgs, GetFindResult } from "@prisma/client/runtime/binary";
import ICountry, { toICountry } from "@/interfaces/ICountry";

export default interface IRegion {
  id: String;
  name: String;
  area: number | null;
  population: number | null;
  createdAt: Date;
  updatedAt: Date | null;
  country?: ICountry;
}

/**
 * Convert prima request to a readable response
 *
 * @param item prisma request result
 * @returns ICountries
 */

export function toIRegion(
  item: Pick<
    Region,
    | "id"
    | "name"
    | "area"
    | "population"
    | "countryId"
    | "createdAt"
    | "updatedAt"
  > & {
    country?: Pick<
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
    departments?: Pick<
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
  },
): IRegion {
  return {
    id: item.id,
    name: item.name,
    area: item.area,
    population: item.population,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    country: item.country ? toICountry(item.country) : undefined,
  };
}
