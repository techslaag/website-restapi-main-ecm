import { Commune, Country, Department, Prisma, Region } from "@prisma/client";
import IRegion, { toIRegion } from "@/interfaces/IRegion";
import Decimal = Prisma.Decimal;
import ICommune from "@/interfaces/ICommune";

export default interface IDepartment {
  id: string;
  name: string;
  area: number | null;
  population: number | null;
  averagePriceBuiltBuilding: Decimal | null;
  averagePriceUnbuiltBuilding: Decimal | null;
  communes?: ICommune[];
  region?: IRegion;
  createdAt: Date;
  updatedAt: Date | null;
}

export function toIDepartment(
  item: Pick<
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
    region?: Pick<
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
    };
    communes?: Pick<
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
  },
): IDepartment {
  return {
    id: item.id,
    name: item.name,
    area: item.area,
    population: item.population,
    averagePriceBuiltBuilding: item.averagePriceBuiltBuilding,
    averagePriceUnbuiltBuilding: item.averagePriceUnbuiltBuilding,
    communes: item.communes ? item.communes.map((c) => c) : undefined,
    region: item.region ? toIRegion(item.region) : undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
