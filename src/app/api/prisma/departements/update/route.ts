import adminMiddleware from "@/lib/auth/adminMiddleware";
import { errorResponse } from "@/lib/utils";
import { serializeError } from "serialize-error";
// import departments from "@/lib/sample-datas/testing/departments.json";
import prisma from "@/lib/prisma";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const loadDepartements = async () => {
    const departmentsPath = `${process.env.BULK_DATA_PREFFIX}/departments.json`;
    const data = await fs.promises.readFile(departmentsPath, "utf8");
    return JSON.parse(data);
  };

  // Usage:
  const departments = await loadDepartements();
  console.log("Datas of departement", departments);
  return adminMiddleware(req, async (user) => {
    try {
      let dones = [];
      for (const payload of departments) {
        if (
          payload !== undefined &&
          (!!payload.averagePriceBuiltBuilding ||
            !!payload.averagePriceUnbuiltBuilding)
        ) {
          let isBuilt = !!payload.averagePriceBuiltBuilding;
          let isUnbuilt = !!payload.averagePriceUnbuiltBuilding;
          if (isBuilt && isUnbuilt) {
            const departments = await prisma.department.updateMany({
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
            dones.push(departments);
          } else if (isUnbuilt) {
            const departments = await prisma.department.updateMany({
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
            dones.push(departments);
          } else if (isBuilt) {
            const departments = await prisma.department.updateMany({
              where: {
                name: payload.name,
              },
              data: {
                averagePriceBuiltBuilding: payload.averagePriceBuiltBuilding,
                averagePriceUnbuiltBuilding: null,
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
