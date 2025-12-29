import { NextResponse } from "next/server";
import { Currency } from "@prisma/client";
import fetchConvertionRates from "../../../../lib/exchangerate-api/fetchConvertionRates";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 30 minutes (1800 seconds)

export async function GET() {
  try {
    const currencies: Currency[] = [
      Currency.xaf,
      Currency.xof, 
      Currency.usd,
      Currency.eur,
      Currency.gbp
    ];

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const currency of currencies) {
      try {
        const exchangeRate = await fetchConvertionRates(currency);
        if (exchangeRate) {
          results.push({
            currency,
            status: "success",
            updatedAt: exchangeRate.updatedAt
          });
          successCount++;
        } else {
          results.push({
            currency,
            status: "failed",
            error: "No data received"
          });
          errorCount++;
        }
      } catch (error) {
        results.push({
          currency,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      message: "Exchange rates update completed",
      timestamp: new Date().toISOString(),
      summary: {
        total: currencies.length,
        successful: successCount,
        failed: errorCount
      },
      details: results
    });

  } catch (error) {
    console.error("[Exchange Rates Cron] Error:", error);
    
    return NextResponse.json({
      message: "Exchange rates update failed",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}