import {
  Currency,
  CurrencyExchangeRates,
  IpLookupBackup,
} from "@prisma/client";
import getCountryByIp from "../freeipapi/getCountryByIp";
import fetchConvertionRates from "../exchangerate-api/fetchConvertionRates";

export default async function countryAndExchangeRatesMiddleware(
  userIp: string,
  currency: Currency,
  cb: (
    ipData: IpLookupBackup,
    exchangeRates: CurrencyExchangeRates,
  ) => Promise<Response> | Response,
) {
  // get country information
  const ipData = await getCountryByIp(userIp);

  if (ipData) {
    // fetch exchange rates
    const exchangeRates = await fetchConvertionRates(currency);

    if (exchangeRates) {
      return await cb(ipData, exchangeRates);
    } else {
      return Response.json(
        {
          message:
            "Impossible d'initier votre paiement. Merci de réessayer plus tard.",
        },
        {
          status: 400,
        },
      );
    }
  } else {
    return Response.json({
      message:
        "Impossible de recuperer vos identiants géographique. Merci de réessayer plus tard.",
    });
  }
}
