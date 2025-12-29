import adminMiddleware from "@/lib/auth/adminMiddleware";
import { errorResponse } from "@/lib/utils";
import { serializeError } from "serialize-error";
// import communes from "@/lib/sample-datas/testing/communes.json";
import prisma from "@/lib/prisma";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const loadCommunes = async () => {
    const communesPath = `${process.env.BULK_DATA_PREFFIX}/communes.json`;
    const data = await fs.promises.readFile(communesPath, "utf8");
    return JSON.parse(data);
  };

  // Usage:
  const communes = await loadCommunes();
  console.log("Datas of commune", communes);
  return adminMiddleware(req, async (user) => {
    try {
      let dones = [];
      for (const payload of communes) {
        if (
          payload !== undefined &&
          (!!payload.averagePriceBuiltBuilding ||
            !!payload.averagePriceUnbuiltBuilding)
        ) {
          let isBuilt = !!payload.averagePriceBuiltBuilding;
          let isUnbuilt = !!payload.averagePriceUnbuiltBuilding;
          if (isBuilt && isUnbuilt) {
            const communes = await prisma.commune.updateMany({
              where: {
                name: payload.name,
              },
              data: {
                averagePriceUnbuiltBuilding:
                  payload.averagePriceUnbuiltBuilding,
                averagePriceBuiltBuilding: payload.averagePriceBuiltBuilding,
                updatedAt: new Date(),
              },
            });
            dones.push(communes);
          } else if (isUnbuilt) {
            const communes = await prisma.commune.updateMany({
              where: {
                name: payload.name,
              },
              data: {
                averagePriceBuiltBuilding: null,
                averagePriceUnbuiltBuilding:
                  payload.averagePriceUnbuiltBuilding,
                updatedAt: new Date(),
              },
            });
            dones.push(communes);
          } else if (isBuilt) {
            const communes = await prisma.commune.updateMany({
              where: {
                name: payload.name,
              },
              data: {
                averagePriceBuiltBuilding: payload.averagePriceBuiltBuilding,
                averagePriceUnbuiltBuilding: null,
                updatedAt: new Date(),
              },
            });
            dones.push(communes);
          }
        }
      }
      return Response.json(dones);
    } catch (err) {
      return errorResponse(serializeError(err), { status: 500 });
    }
  });
}
