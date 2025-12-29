import { Country, Energy, Prisma, Region } from "@prisma/client";

export default interface ICountry {
  id: String;
  countryName: string;
  isoCode2: string;
  isoCode3: string;
  numericCode: number;
  capital?: string | null;
  population?: number | null;
  area?: number | null;
  currencyCode: string | null;
  officialLanguage?: string | null;
  continent?:
    | "Asia"
    | "Africa"
    | "NordAmerica"
    | "SouthAmerica"
    | "Antarctica"
    | "Europe"
    | "Oceania"
    | null;
  timeZone?: string | null;
  callingCode?: string | null;
  internetTLD?: string | null;
  hdi?: number | null;
  gdp?: number | null;
  createdAt: Date;
  updatedAt?: Date | null;
}

/**
 * Convert prima request to a readable response
 *
 * @param item prisma request result
 * @returns ICountries
 */

export function toICountry(
  item: Pick<
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
  > & {
    energy?: Pick<
      Energy,
      | "id"
      | "name"
      | "price"
      | "currency"
      | "measurementId"
      | "createdAt"
      | "updatedAt"
      | "countryId"
      | "successorId"
    >[];
    region?: Pick<
      Region,
      | "id"
      | "name"
      | "area"
      | "population"
      | "countryId"
      | "createdAt"
      | "updatedAt"
    >;
  },
): ICountry {
  return {
    id: item.id,
    countryName: item.countryName,
    isoCode2: item.isoCode2,
    isoCode3: item.isoCode3,
    numericCode: item.numericCode,
    capital: item.capital,
    population: item.population,
    area: item.area,
    currencyCode: item.currencyCode,
    officialLanguage: item.officialLanguage,
    continent: item.continent,
    timeZone: item.timeZone,
    callingCode: item.callingCode,
    internetTLD: item.internetTLD,
    gdp: item.gdp,
    hdi: item.hdi,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
