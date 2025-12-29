import IPaginateResponse from "@/interfaces/IPaginateResponse";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { extractQueryParams, toSafeJSON } from "@/lib/utils";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import { toIDepartment } from "@/interfaces/IDepartment";

export const dynamic = "force-dynamic";

export async function GET(req: Request, res: Response) {
  const queryParams = extractQueryParams(req);

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);

  const whereQuery: Prisma.DepartmentWhereInput = {};
  const paginateMeta = await getPaginationMetaData(
    "Department",
    page,
    limit,
    whereQuery,
  );

  const departments = await prisma.department.findMany({
    where: whereQuery,
    ...paginateMeta.query,
    orderBy: {
      id: "desc",
    },
    include: {
      region: {
        include: {
          departments: true,
          country: true,
        },
      },
      communes: true,
    },
  });

  if (!departments) {
    return Response.json("Departments not found", { status: 200 });
  }

  const parsedDepartments = departments.map(toIDepartment);

  return Response.json(
    toSafeJSON<IPaginateResponse<any>>({
      ...paginateMeta.meta,
      items: parsedDepartments,
    }),
  );
}
