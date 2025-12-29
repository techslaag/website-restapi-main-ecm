import ICommune, { toICommune } from "@/interfaces/ICommune";
import {
  Commune,
  Country,
  Department,
  Neighborhood,
  Prisma,
  Region,
} from "@prisma/client";
import { toSafeJSON } from "@/lib/utils";
import Decimal = Prisma.Decimal;

export default interface INeighborhood {
  id: string;
  name: string;
  averagePriceBuiltBuilding?: Decimal | null;
  averagePriceUnbuiltBuilding?: Decimal | null;
  area: number | null;
  population: number | null;
  commune?: ICommune;
  predecessor?: INeighborhood;
  successor?: INeighborhood;
  createdAt: Date;
  updatedAt: Date | null;
}

export function toINeighborhood(
  item: Pick<
    Neighborhood,
    | "id"
    | "name"
    | "averagePriceBuiltBuilding"
    | "averagePriceUnbuiltBuilding"
    | "area"
    | "population"
    | "communeId"
    | "successorId"
    | "createdAt"
    | "updatedAt"
  > & {
    commune?: Pick<
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
    };
    predecessor?: Pick<
      Neighborhood,
      | "id"
      | "name"
      | "averagePriceBuiltBuilding"
      | "averagePriceUnbuiltBuilding"
      | "area"
      | "population"
      | "communeId"
      | "successorId"
      | "createdAt"
      | "updatedAt"
    > & {
      commune?: Pick<
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
      };
    };
    successor?: Pick<
      Neighborhood,
      | "id"
      | "name"
      | "averagePriceBuiltBuilding"
      | "averagePriceUnbuiltBuilding"
      | "area"
      | "population"
      | "communeId"
      | "successorId"
      | "createdAt"
      | "updatedAt"
    > & {
      commune?: Pick<
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
      };
    };
  },
): INeighborhood {
  return {
    id: item.id,
    name: item.name,
    averagePriceBuiltBuilding: item.averagePriceBuiltBuilding,
    averagePriceUnbuiltBuilding: item.averagePriceUnbuiltBuilding,
    area: item.area,
    population: item.population,
    commune: item.commune ? toICommune(item.commune) : undefined,
    predecessor: item.predecessor
      ? toINeighborhood(item.predecessor)
      : undefined,
    successor: item.successor ? toINeighborhood(item.successor) : undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
