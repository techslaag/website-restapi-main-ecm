import prisma from "@/lib/prisma";
import { extractQueryParams } from "@/lib/utils/index";
import { NextRequest } from "next/server";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const queryParams: { limit: string } = extractQueryParams(req);

    const limit = Number(queryParams.limit ?? 25000);
    
    // count all classements
    const classementCount = await prisma.mod180_term_taxonomy.count({
      where: {
        taxonomy: "classement",
      },
    });

    const totalPages = Math.ceil(classementCount / limit);

    return Response.json({
      perPage: limit,
      classementCount,
      totalPages,
    });
  } catch (error) {
    return Response.json(serializeError(error), {
      status: 500,
    });
  }
}