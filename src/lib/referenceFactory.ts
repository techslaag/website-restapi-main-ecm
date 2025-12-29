import moment from "moment";
import prisma from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function generatePaymentReference(
  product: "subscription" | "post" | "product" | "packageFw" | "documentaire",
) {
  const currentDate = moment();
  // count the payment
  const todayPaymentsCount = await prisma.payment.count({
    where: {
      createdAt: {
        gte: currentDate.startOf("day").toDate(),
        lte: currentDate.endOf("day").toDate(),
      },
    },
  });

  // random 4 character
  const randStr = randomBytes(4).toString("hex");

  const getProductSymbol = () => {
    switch (product) {
      case "subscription":
        return "S";

      case "post":
        return "A";

      case "product":
        return "P";
      case "packageFw":
        return "FW";
      case "documentaire":
        return "D";
    }
  };

  return `ECP${getProductSymbol()}${currentDate.format("YY")}${currentDate.format("MM").padStart(2, "0")}${currentDate.format("DD").padStart(2, "0")}.${Number(
    todayPaymentsCount + 1,
  )
    .toString()
    .padStart(4, "0")}.${randStr.substring(0, 4)}`.toUpperCase();
}

export async function generateSubscriptionReference() {
  const currentDate = moment();
  // count the payment
  const todayCount = await prisma.subscription.count({
    where: {
      createdAt: {
        gte: currentDate.startOf("day").toDate(),
        lte: currentDate.endOf("day").toDate(),
      },
    },
  });

  // random 4 character
  const randStr = randomBytes(2).toString("hex");

  return `ECS${currentDate.format("YY")}${currentDate.format("MM").padStart(2, "0")}${currentDate.format("DD").padStart(2, "0")}.${Number(
    todayCount + 1,
  )
    .toString()
    .padStart(4, "0")}.${randStr.substring(0, 4)}`.toUpperCase();
}
