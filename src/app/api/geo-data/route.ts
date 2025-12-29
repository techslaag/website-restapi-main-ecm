import getCountryByIp from "@/lib/freeipapi/getCountryByIp";
import getExchangeRatesFromDb from "@/lib/exchangerate-api/getExchangeRatesFromDb";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload: { ip: string } = await request.json();

    // Get country by IP (with XAF as default fallback)
    let ipData;
    try {
      ipData = await getCountryByIp(payload.ip);
    } catch (error) {
      console.warn("[geo-data] IP lookup failed, using Cameroon/XAF as fallback:", error);
      // Default to Cameroon/XAF if IP lookup fails
      ipData = {
        id: `fallback-${Date.now()}`,
        ipAddress: payload.ip || "unknown",
        countryAlpha2Code: "CM",
        countryName: "Cameroon", 
        currencyCode: "XAF",
        timeZones: "Africa/Douala",
        isProxy: false,
        createdAt: new Date()
      };
    }

    // Get exchange rates directly from database
    const exchangeRates = await getExchangeRatesFromDb();

    if (!exchangeRates) {
      // If no exchange rates in database, create fallback with XAF focus
      const fallbackRates = {
        id: `fallback-rates-${Date.now()}`,
        provider: "fallback" as const,
        currency: "eur",
        data: JSON.stringify({
          conversion_rates: {
            XAF: 655.95,  // Default XAF rate
            EUR: 1.0,
            USD: 1.08,
            GBP: 0.86,
            XOF: 655.95,
            NGN: 1657.66,
            JPY: 179.24,
            CAD: 1.62,
            AUD: 1.77,
            CHF: 0.92,
            CNY: 8.24,
            INR: 102.58,
            BRL: 6.10,
            MXN: 21.20,
            ZAR: 19.80
          }
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return Response.json({
        country: ipData,
        echangeRates: fallbackRates,
      });
    }

    return Response.json({
      country: ipData,
      echangeRates: exchangeRates,
    });
  } catch (error) {
    console.error("[geo-data] Error:", error);
    
    // Return XAF fallback even on complete failure
    return Response.json({
      country: {
        id: `error-fallback-${Date.now()}`,
        ipAddress: "unknown",
        countryAlpha2Code: "CM", 
        countryName: "Cameroon",
        currencyCode: "XAF",
        timeZones: "Africa/Douala",
        isProxy: false,
        createdAt: new Date()
      },
      echangeRates: {
        id: `error-rates-${Date.now()}`,
        provider: "fallback" as const,
        currency: "eur",
        data: JSON.stringify({
          conversion_rates: {
            XAF: 655.95,
            EUR: 1.0,
            USD: 1.08,
            GBP: 0.86,
            XOF: 655.95
          }
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }
}
