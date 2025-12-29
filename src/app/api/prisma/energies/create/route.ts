import adminMiddleware from "@/lib/auth/adminMiddleware";
import { errorResponse } from "@/lib/utils";
import { serializeError } from "serialize-error";
import prisma from "@/lib/prisma";
import { Currency } from "@prisma/client";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const loadEnergies = async () => {
    const energiesPath = `${process.env.BULK_DATA_PREFFIX}/energies.json`;
    const data = await fs.promises.readFile(energiesPath, "utf8");
    return JSON.parse(data);
  };

  // Usage:
  const energies = await loadEnergies();
  return adminMiddleware(req, async (user) => {
    try {
      let dones = [];
      for (const payload of energies) {
        if (payload !== undefined) {
          if (payload.successorId) {
            const energies = await prisma.energy.create({
              data: {
                name: payload.name,
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
                measurementId: payload.measurementId,
                countryId: payload.countryId,
                successorId: payload.successorId,
                updatedAt: new Date(),
              },
            });
            dones.push(energies);
          } else {
            const energies = await prisma.energy.create({
              data: {
                name: payload.name,
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
                measurementId: payload.measurementId,
                countryId: payload.countryId,
                updatedAt: new Date(),
              },
            });
            dones.push(energies);
          }
        }
      }
      return Response.json(dones);
    } catch (err) {
      return errorResponse(serializeError(err), { status: 500 });
    }
  });
}
