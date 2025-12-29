import { Currency, CurrencyExchangeRates } from "@prisma/client";
import prisma from "../prisma";

export default async function getExchangeRatesFromDb(): Promise<CurrencyExchangeRates | null> {
  try {
    // Get the most recent EUR exchange rates from database
    const exchangeRates = await prisma.currencyExchangeRates.findFirst({
      where: {
        currency: "eur"
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    if (exchangeRates) {
      return exchangeRates;
    }

    // If no EUR rates found, try any available rates
    const anyRates = await prisma.currencyExchangeRates.findFirst({
      orderBy: {
        updatedAt: "desc"
      }
    });

    if (anyRates) {
      return anyRates;
    }

    // If no rates in database at all, return null
    console.warn("[getExchangeRatesFromDb] No exchange rates found in database");
    return null;

  } catch (error) {
    console.error("[getExchangeRatesFromDb] Database error:", error);
    return null;
  }
}