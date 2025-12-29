import IFlutterwaveVerificationResponse from "@/interfaces/IFlutterwaveVerificationResponse";
import prisma from "@/lib/prisma";
import { extractQueryParams } from "@/lib/utils";
import { syncTransactionStatus } from "@/lib/utils/flutterwaveUtils";
import { applyPaymentResult } from "@/lib/utils/paymentUtils";
import { Payment } from "@prisma/client";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 30 minutes (1800 seconds)

export async function GET(req: Request) {
  try {
    const { testStatus }: { testStatus: Payment["status"] } =
      await extractQueryParams(req);
    /**
     * Fetch processing flutterwave transactions
     */
    const payments = await prisma.payment.findMany({
      where: {
        provider: "flutterwave",
        status: "processing",
      },
      take: 10,
    });

    for (const payment of payments) {
      await syncTransactionStatus(payment);
    }

    return new Response(undefined, { status: 204 });
  } catch (error) {
    return Response.json(serializeError(error), { status: 500 });
  }
}
