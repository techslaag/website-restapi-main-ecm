import adminMiddleware from "@/lib/auth/adminMiddleware";
import { errorResponse } from "@/lib/utils";
import { serializeError } from "serialize-error";
// import departments from "@/lib/sample-datas/testing/departments.json";
import prisma from "@/lib/prisma";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const loadDepartements = async () => {
    const departmentsPath = `${process.env.BULK_DATA_PREFFIX}/departments.json`;
    const data = await fs.promises.readFile(departmentsPath, "utf8");
    return JSON.parse(data);
  };

  // Usage:
  const departments = await loadDepartements();
  return adminMiddleware(req, async (user) => {
    try {
      let dones = [];
      for (const payload of departments) {
        if (payload !== undefined) {
          let isBuilt = !!payload.averagePriceBuiltBuilding;
          let isUnbuilt = !!payload.averagePriceUnbuiltBuilding;
          if (isBuilt && isUnbuilt) {
            const departments = await prisma.department.createMany({
              data: {
                name: payload.name,
                area: payload.area,
                population: payload.population,
                regionId: payload.regionId,
                averagePriceUnbuiltBuilding:
                  payload.averagePriceUnbuiltBuilding,
                averagePriceBuiltBuilding: payload.averagePriceBuiltBuilding,
                updatedAt: new Date(),
              },
            });
            dones.push(departments);
          } else if (isUnbuilt) {
            const departments = await prisma.department.createMany({
              data: {
                name: payload.name,
                area: payload.area,
                population: payload.population,
                regionId: payload.regionId,
                averagePriceUnbuiltBuilding:
                  payload.averagePriceUnbuiltBuilding,
                updatedAt: new Date(),
              },
            });
            dones.push(departments);
          } else if (isBuilt) {
            const departments = await prisma.department.createMany({
              data: {
                name: payload.name,
                area: payload.area,
                population: payload.population,
                regionId: payload.regionId,
                averagePriceBuiltBuilding: payload.averagePriceBuiltBuilding,
                updatedAt: new Date(),
              },
            });
            dones.push(departments);
          } else if (!isBuilt && !isUnbuilt) {
            const departments = await prisma.department.createMany({
              data: {
                name: payload.name,
                area: payload.area,
                population: payload.population,
                regionId: payload.regionId,
                updatedAt: new Date(),
              },
            });
            dones.push(departments);
          }
        }
      }
      return Response.json(dones);
    } catch (err) {
      return errorResponse(serializeError(err), { status: 500 });
    }
  });
}
