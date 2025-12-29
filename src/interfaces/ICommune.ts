import { DefaultArgs, GetFindResult } from "@prisma/client/runtime/binary";
import {
  Commune,
  Country,
  Department,
  Neighborhood,
  Prisma,
  Region,
} from "@prisma/client";
import IDepartment, { toIDepartment } from "@/interfaces/IDepartment";
import { toSafeJSON } from "@/lib/utils";
import Decimal = Prisma.Decimal;

export default interface ICommune {
  id: string;
  name: string;
  area: number | null;
  population: number | null;
  averagePriceBuiltBuilding: Decimal | null;
  averagePriceUnbuiltBuilding: Decimal | null;
  type: "districtMunicipality" | "ruralCommune";
  department?: IDepartment;
  createdAt: Date;
  updatedAt: Date | null;
}

export function toICommune(
  item: Pick<
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
    };
  },
): ICommune {
  return {
    id: item.id,
    name: item.name,
    area: item.area,
    population: item.population,
    averagePriceBuiltBuilding: item.averagePriceBuiltBuilding,
    averagePriceUnbuiltBuilding: item.averagePriceUnbuiltBuilding,
    type: item.type,
    department: item.department ? toIDepartment(item.department) : undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
