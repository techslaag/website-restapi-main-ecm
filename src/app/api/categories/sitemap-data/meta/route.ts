import prisma from "@/lib/prisma";
import { extractQueryParams } from "@/lib/utils/index";
import { NextRequest } from "next/server";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const queryParams: { limit: string } = extractQueryParams(req);

    const limit = Number(queryParams.limit ?? 25000);
    
    // count all categories - matching the main categories route behavior
    const categoryCount = await prisma.mod180_term_taxonomy.count({
      where: {
        taxonomy: "category",
      },
    });

    const totalPages = Math.ceil(categoryCount / limit);

    return Response.json({
      perPage: limit,
      categoryCount,
      totalPages,
    });
  } catch (error) {
    return Response.json(serializeError(error), {
      status: 500,
    });
  }
}