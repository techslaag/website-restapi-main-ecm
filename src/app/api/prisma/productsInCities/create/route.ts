import adminMiddleware from "@/lib/auth/adminMiddleware";
import { errorResponse } from "@/lib/utils";
import { serializeError } from "serialize-error";
// import productsInCities from "@/lib/sample-datas/testing/productsincities.json";
import prisma from "@/lib/prisma";
import { Avalaibility, Currency } from "@prisma/client";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const loadProductsincities = async () => {
    const productsInCitiesPath = `${process.env.BULK_DATA_PREFFIX}/productsincities.json`;
    const data = await fs.promises.readFile(productsInCitiesPath, "utf8");
    return JSON.parse(data);
  };

  // Usage:
  const productsInCities = await loadProductsincities();
  return adminMiddleware(req, async (user) => {
    try {
      let dones = [];
      for (const payload of productsInCities) {
        if (payload !== undefined) {
          const products = await prisma.productInCity.create({
            data: {
              cityId: payload.cityId,
              productId: payload.productId,
              price: payload.price,
              currency:
                payload.currency === "xaf"
                  ? Currency.xaf
                  : payload.currency === "xof"
                    ? Currency.xof
                    : payload.currency === "eur"
                      ? Currency.eur
                      : payload.currency === "usd"
                        ? Currency.usd
                        : Currency.gbp,
              avalaibility:
                payload.avalaibility === "Avalaible"
                  ? Avalaibility.Avalaible
                  : Avalaibility.Unavalaible,
              entryDate: payload.entryDate,
              updatedAt: new Date(),
            },
          });
          dones.push(products);
        }
      }
      return Response.json(dones);
    } catch (err) {
      return errorResponse(serializeError(err), { status: 500 });
    }
  });
}
