import prisma from "@/lib/prisma";
import { extractQueryParams } from "@/lib/utils/index";
import { NextRequest } from "next/server";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const queryParams: { limit: string } = extractQueryParams(req);

    const limit = Number(queryParams.limit ?? 25000);
    
    // count all tags - matching consistent behavior with other taxonomies
    const tagCount = await prisma.mod180_term_taxonomy.count({
      where: {
        taxonomy: "post_tag",
      },
    });

    const totalPages = Math.ceil(tagCount / limit);

    return Response.json({
      perPage: limit,
      tagCount,
      totalPages,
    });
  } catch (error) {
    return Response.json(serializeError(error), {
      status: 500,
    });
  }
}