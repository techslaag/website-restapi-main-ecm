import IExchangerateApiResponse from "@/interfaces/IExchangerateApiResponse";
import IPaginateResponse from "@/interfaces/IPaginateResponse";
import {
  Currency,
  CurrencyExchangeRates,
  IpLookupBackup,
} from "@prisma/client";
import { createHash } from "crypto";
import { ZodError } from "zod";

export function extractQueryParams(req: Request) {
  const urlParsed = new URL(req.url);
  const r: any = {};

  for (const key of Array.from(urlParsed.searchParams.keys())) {
    r[key] = urlParsed.searchParams.get(key);
  }
  return r;
}

export function getIncrease(from: number | string, to: number | string) {
  return Number((Number(Number(to) - Number(from)) * 100) / Number(to)).toFixed(
    2,
  );
}

export function getTimeToReadEstimation(
  content: string,
  unit: "second" | "minute",
) {
  const totalSeconds = Math.round(content.length / (250 * 5)) * 60;
  switch (unit) {
    case "second":
      return totalSeconds;

    case "minute":
      return Number(totalSeconds / 60);
  }
}

export async function fetchPaginatedWpListInServerAction<
  T extends any = any,
  P extends any = T,
>(
  endpoint: string,
  options?: {
    page?: number;
    limit?: number;
    parser?: (input: T) => P;
    queryParams?: Record<string, string | null | undefined>;
  },
): Promise<IPaginateResponse<P>> {
  // extract the page query parameter
  const pageValue = Number(options?.page ?? options?.queryParams?.page ?? 1);

  // extract limit query parameter
  const limitValue = Number(
    options?.limit ?? options?.queryParams?.limit ?? 25,
  );

  // api call url
  const callUrl = new URL(`${process.env.NEXT_PUBLIC_API_URL}/wp${endpoint}`);

  // parameters injection
  callUrl.searchParams.set("page", pageValue.toString());
  callUrl.searchParams.set("per_page", limitValue.toString());

  // get query if defined
  const queryParams = options?.queryParams ?? {};

  for (const queryParamKey of Object.keys(queryParams)) {
    callUrl.searchParams.set(queryParamKey, queryParams[queryParamKey] ?? "");
  }

  return await fetch(callUrl).then(async (res) => {
    const headers = res.headers;
    const result: any[] = await res.json();

    return {
      page: pageValue,
      limit: limitValue,
      total: Number(headers.get("x-wp-total")),
      totalPages: Number(headers.get("x-wp-totalpages")),
      items: options?.parser
        ? result.map((item) => options?.parser?.(item))
        : result,
    } as IPaginateResponse<P>;
  });
}

export function toStringOrUndefined(input?: string) {
  if (typeof input === "string") {
    if (input.length === 0) {
      return undefined;
    } else {
      return input;
    }
  } else {
    return undefined;
  }
}

export function splitToSubArrays<T extends any = any>(
  array: Array<T>,
  subArraySize: number,
): T[][] {
  const list = Array.from([...array]);
  const sub: T[][] = [];
  while (list.length !== 0) {
    sub.push(list.splice(0, subArraySize));
  }
  return sub;
}

export function makeItOdd<T extends any = any>(arr: T[]) {
  if (arr.length !== 0) {
    if (arr.length % 2 === 0) {
      return Array.from([...arr, { ...(arr[0] as any), id: arr.length + 1 }]);
    } else {
      return arr;
    }
  } else {
    return arr;
  }
}

export const HTML_TAG_FREE_REGEX = /<(?:"[^"]*"['"]*|'[^']*'['"]*|[^'">])+>/g;

/**
 * Inject query params in the given url
 *
 * @param url Given url
 * @param payload query parameters as an object
 * @returns string
 */
export function injectQueryParams(
  url: string,
  payload: Record<string, string | null | undefined>,
) {
  const parsedUrl = new URL(url);
  for (const key of Object.keys(payload)) {
    parsedUrl.searchParams.set(key, payload[key] ?? "");
  }
  return parsedUrl.toString();
}

/**
 * Exclude properties in the given object
 *
 * @param data given data
 * @param propsToExclude properties to exclude
 * @returns object
 */
export const excludeProps = <
  T extends any = any,
  key extends keyof T = keyof T,
>(
  data: T,
  propsToExclude: Array<key>,
): Omit<T, (typeof propsToExclude)[0]> => {
  const value: any = {};
  for (const key of Object.keys(data as any)) {
    if (!propsToExclude.includes(key as any)) {
      value[key] = (data as any)[key];
    }
  }
  return value;
};

/**
 * Helper to extract zod response
 *
 * @param data response payload
 * @returns HTTP response
 */
export const errorResponse = (data: any, init?: ResponseInit) => {
  // parse zod error on production
  if (data.name === "ZodError") {
    const zodErr = data as ZodError;

    // extract message
    const errorMessage = zodErr.issues.map((item) => item.message).join("; ");

    // update the status to 400 for BadRequest
    data.status = 400;

    // new error payload
    data = {
      ...(() => {
        // return other error information on development mode
        if (process.env.NODE_ENV !== "production") {
          return { ...data.error };
        } else {
          return {};
        }
      })(),
      message: errorMessage,
    };
  }

  return Response.json(data, init);
};

/**
 * Hash the given value
 * @param value string to be hashed
 * @returns string
 */
export function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function getClientIp(request: Request) {
  let ip: string;
  const xForwardedFor = request.headers.get("x-forwarded-for"),
    xRealIp = request.headers.get("x-real-ip");
  if (xForwardedFor) {
    ip = xForwardedFor.split(",")[0];
  } else if (xRealIp) {
    ip = xRealIp;
  } else {
    ip = "::1";
  }
  return ip;
}

export async function requestJsonBody(req: Request) {
  return JSON.parse(await req.text());
}

export function toSafeJSON<T extends any = any>(value: any): T {
  return JSON.parse(
    JSON.stringify(value, (key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
}

export function isNumeric(value: any): boolean {
  if (typeof value === "number") {
    return true;
  } else {
    if (typeof value === "string") {
      if (value.length !== 0) {
        try {
          BigInt(value);
          return true;
        } catch (error) {
          return false;
        }
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
}

export function forceNumberOrDefault(value: any, defaultValue: number) {
  if (typeof value === "number") {
    return value;
  } else if (typeof value === "string") {
    const parsed = Number(value);
    if (isNaN(parsed)) {
      return defaultValue;
    } else {
      return parsed;
    }
  } else if (typeof value === "bigint") {
    return Number(value.toString());
  } else {
    return defaultValue;
  }
}

export function sanitizeEmail(email?: string | null) {
  return email ? email.replaceAll("+", "") : undefined;
}

export function convertAmountToClientCurrency(
  country: IpLookupBackup,
  exchangeRates: CurrencyExchangeRates,
  amount: number | string,
  inCurrency: string,
): { amount: number; currency: string } {
  // Désérialiser le JSON si c'est une string
  const ratesData = typeof exchangeRates.data === 'string' 
    ? JSON.parse(exchangeRates.data) 
    : exchangeRates.data;
  const rates: IExchangerateApiResponse = ratesData as any;
  type RateType = keyof typeof rates.conversion_rates;
  if (country.currencyCode.toLowerCase() === inCurrency.toLowerCase()) {
    return {
      amount: Number(amount),
      currency: inCurrency,
    };
  } else {
    // base currency is local currency
    if (
      country.currencyCode.toLowerCase() ===
      exchangeRates.currency.toLowerCase()
    ) {
      const localValueRate =
        rates.conversion_rates[inCurrency.toUpperCase() as RateType];

      // converted
      if (typeof localValueRate === "number") {
        return {
          amount: Number(Number(amount) * localValueRate),
          currency: country.currencyCode,
        };
      } else {
        return {
          amount: Number(amount),
          currency: inCurrency,
        };
      }
    } else if (
      inCurrency.toLowerCase() === exchangeRates.currency.toLowerCase()
    ) {
      // base currency is the in currency
      const localValueRate =
        rates.conversion_rates[country.currencyCode.toUpperCase() as RateType];

      if (typeof localValueRate === "number") {
        return {
          amount: Number(Number(amount) * localValueRate),
          currency: country.currencyCode,
        };
      } else {
        return {
          amount: Number(amount),
          currency: inCurrency,
        };
      }
    } else {
      const inValueRate =
        rates.conversion_rates[inCurrency.toUpperCase() as RateType];

      const localValueRate =
        rates.conversion_rates[country.currencyCode.toUpperCase() as RateType];

      if (
        typeof inValueRate === "number" &&
        typeof localValueRate === "number"
      ) {
        const baseValue = Number(1 / inValueRate);

        return {
          amount: Number(Number(amount) * baseValue),
          currency: country.currencyCode,
        };
      } else {
        return {
          amount: Number(amount),
          currency: inCurrency,
        };
      }
    }
  }
}

export function roundToNext100(amount: number) {
  const roundedToNext100 = Math.ceil(amount / 100) * 100;
  return roundedToNext100;
}
