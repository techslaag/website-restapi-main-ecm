import { Currency, CurrencyExchangeRates } from "@prisma/client";
import { captureException } from "@sentry/nextjs";
import moment from "moment";
import prisma from "../prisma";

export default async function fetchConvertionRates(
  currency: Currency,
): Promise<CurrencyExchangeRates | null> {
  const DELAY_IN_SECONDS = 6 * 60 * 60; // 6 hours 

  // load packup
  const backup = await prisma.currencyExchangeRates.findFirst({
    where: {
      currency: currency,
      updatedAt: {
        gte: moment().add(DELAY_IN_SECONDS, "seconds").toDate(),
      },
    },
  });

  if (backup) {
    return backup;
  } else {
    /**
     * The cache is set to send a request every 6hours.
     * The cache can be completely removed when using the paid plan
     */
    const result = await fetch(
      `${process.env.EXCHANGERATE_API_URL}/latest/${currency}`,
      {
        next: {
          revalidate: 6 * 60 * 60, // update every 6 hours.
        },
      },
    )
      .then(async (response) => {
        const json = await response.json();
        if (response.ok) {
          return json;
        } else {
          throw json;
        }
      })
      .catch((err) => {
        captureException(err);
        return null;
      });

    if (result) {
      console.log("[fetchConvertionRates] Saving exchange rates for currency:", currency);
      
      // upsert the exchange rate api
      return await prisma.currencyExchangeRates.upsert({
        where: {
          currency: currency,
        },
        create: {
          currency: currency,
          data: JSON.stringify(result), // Convertir en string JSON
          provider: "exchangeRateApi",
        },
        update: {
          data: JSON.stringify(result), // Convertir en string JSON
          updatedAt: new Date(),
        },
      });
    } else {
      console.log("[fetchConvertionRates] No exchange rate data received");
      return null;
    }
  }
}
