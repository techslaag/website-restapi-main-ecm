import adminMiddleware from "@/lib/auth/adminMiddleware";
import { errorResponse } from "@/lib/utils";
import { serializeError } from "serialize-error";
// import communes from "@/lib/sample-datas/testing/communes.json";
import prisma from "@/lib/prisma";
import { CommuneType } from "@prisma/client";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const loadCommunes = async () => {
    const communesPath = `${process.env.BULK_DATA_PREFFIX}/communes.json`;
    const data = await fs.promises.readFile(communesPath, "utf8");
    return JSON.parse(data);
  };

  // Usage:
  const communes = await loadCommunes();
  return adminMiddleware(req, async (user) => {
    try {
      let dones = [];
      for (const payload of communes) {
        if (payload !== undefined) {
          let isBuilt = !!payload.averagePriceBuiltBuilding;
          let isUnbuilt = !!payload.averagePriceUnbuiltBuilding;
          if (isBuilt && isUnbuilt) {
            const commune = await prisma.commune.create({
              data: {
                name: payload.name,
                averagePriceUnbuiltBuilding:
                  payload.averagePriceUnbuiltBuilding,
                averagePriceBuiltBuilding: payload.averagePriceBuiltBuilding,
                type:
                  payload.type === CommuneType.ruralCommune
                    ? CommuneType.ruralCommune
                    : CommuneType.districtMunicipality,
                departmentId: payload.departmentId,
                updatedAt: new Date(),
              },
            });
            dones.push(commune);
          } else if (isBuilt) {
            const commune = await prisma.commune.create({
              data: {
                name: payload.name,
                averagePriceBuiltBuilding: payload.averagePriceBuiltBuilding,
                type:
                  payload.type === CommuneType.ruralCommune
                    ? CommuneType.ruralCommune
                    : CommuneType.districtMunicipality,
                departmentId: payload.departmentId,
                updatedAt: new Date(),
              },
            });
            dones.push(commune);
          } else if (isUnbuilt) {
            const commune = await prisma.commune.create({
              data: {
                name: payload.name,
                averagePriceUnbuiltBuilding:
                  payload.averagePriceUnbuiltBuilding,
                type:
                  payload.type === CommuneType.ruralCommune
                    ? CommuneType.ruralCommune
                    : CommuneType.districtMunicipality,
                departmentId: payload.departmentId,
                updatedAt: new Date(),
              },
            });
            dones.push(commune);
          } else {
            const commune = await prisma.commune.create({
              data: {
                name: payload.name,
                type:
                  payload.type === CommuneType.ruralCommune
                    ? CommuneType.ruralCommune
                    : CommuneType.districtMunicipality,
                departmentId: payload.departmentId,
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
