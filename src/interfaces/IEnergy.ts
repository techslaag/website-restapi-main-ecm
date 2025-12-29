import IMeasurement, { toIMeasurement } from "@/interfaces/IMeasurement";
import ICountry, { toICountry } from "@/interfaces/ICountry";
import { Country, Energy, Measurement, Prisma } from "@prisma/client";
import Decimal = Prisma.Decimal;

export default interface IEnergy {
  id: string;
  name: string;
  price: Decimal;
  predecessorPrice?: Decimal | null;
  currency: "usd" | "gbp" | "eur" | "xaf" | "xof";
  measurement: IMeasurement;
  successorId: string | null;
  country?: ICountry;
  createdAt: Date;
  updatedAt?: Date | null;
}

export function toIEnergy(
  item: Pick<
    Energy,
    | "id"
    | "name"
    | "price"
    | "currency"
    | "measurementId"
    | "successorId"
    | "countryId"
    | "createdAt"
    | "updatedAt"
  > & {
    measurement: Pick<
      Measurement,
      "id" | "name" | "notation" | "type" | "createdAt" | "updatedAt"
    >;
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
    predecessor?: Pick<
      Energy,
      | "id"
      | "name"
      | "price"
      | "currency"
      | "measurementId"
      | "successorId"
      | "countryId"
      | "createdAt"
      | "updatedAt"
    >;
    successor?: Pick<
      Energy,
      | "id"
      | "name"
      | "price"
      | "currency"
      | "measurementId"
      | "successorId"
      | "countryId"
      | "createdAt"
      | "updatedAt"
    >;
  },
): IEnergy {
  return {
    id: item.id,
    name: item.name,
    price: item.price,
    predecessorPrice: item.predecessor ? item.predecessor.price : null,
    currency: item.currency,
    successorId: item.successorId,
    measurement: toIMeasurement(item.measurement),
    country: item.country ? toICountry(item.country) : undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
