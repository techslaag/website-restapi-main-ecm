import adminMiddleware from "@/lib/auth/adminMiddleware";
import { errorResponse } from "@/lib/utils";
import { serializeError } from "serialize-error";
// import neighborhoods from "@/lib/sample-datas/testing/neighborhoods.json";
import prisma from "@/lib/prisma";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const loadNeighborhoods = async () => {
    const neighborhoodsPath = `${process.env.BULK_DATA_PREFFIX}/neighborhoods.json`;
    const data = await fs.promises.readFile(neighborhoodsPath, "utf8");
    return JSON.parse(data);
  };

  // Usage:
  const neighborhoods = await loadNeighborhoods();
  return adminMiddleware(req, async (user) => {
    try {
      let dones = [];
      for (const payload of neighborhoods) {
        if (payload !== undefined) {
          let isBuilt = !!payload.averagePriceBuiltBuilding;
          let isUnbuilt = !!payload.averagePriceUnbuiltBuilding;
          if (isBuilt && isUnbuilt) {
            const neighborhood = await prisma.neighborhood.create({
              data: {
                name: payload.name,
                averagePriceUnbuiltBuilding:
                  payload.averagePriceUnbuiltBuilding,
                averagePriceBuiltBuilding: payload.averagePriceBuiltBuilding,
                communeId: payload.communeId,
                updatedAt: new Date(),
              },
            });
            dones.push(neighborhood);
          } else if (isBuilt) {
            const neighborhood = await prisma.neighborhood.create({
              data: {
                name: payload.name,
                averagePriceBuiltBuilding: payload.averagePriceBuiltBuilding,
                communeId: payload.communeId,
                updatedAt: new Date(),
              },
            });
            dones.push(neighborhood);
          } else if (isUnbuilt) {
            const neighborhood = await prisma.neighborhood.create({
              data: {
                name: payload.name,
                averagePriceUnbuiltBuilding:
                  payload.averagePriceUnbuiltBuilding,
                communeId: payload.communeId,
                updatedAt: new Date(),
              },
            });
            dones.push(neighborhood);
          } else {
            const commune = await prisma.neighborhood.create({
              data: {
                name: payload.name,
                communeId: payload.communeId,
                updatedAt: new Date(),
              },
            });
            dones.push(commune);
          }
        }
      }
      return Response.json(dones);
    } catch (err) {
      return errorResponse(serializeError(err), { status: 500 });
    }
  });
}
