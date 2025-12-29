import prisma from "@/lib/prisma";
import { toIDepartment } from "@/interfaces/IDepartment";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: departmentId } }: { params: { id: string } },
) {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
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

  // region exists
  if (department) {
    return Response.json(toIDepartment(department));
  } else {
    return Response.json(
      {
        message: "Departement introuvable.",
      },
      { status: 200 },
    );
  }
}
