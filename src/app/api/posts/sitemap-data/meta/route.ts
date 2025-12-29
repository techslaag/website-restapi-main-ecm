import prisma from "@/lib/prisma";
import { extractQueryParams } from "@/lib/utils/index";
import { NextRequest } from "next/server";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const queryParams: { limit: string } = extractQueryParams(req);

    const limit = Number(queryParams.limit ?? 25000);
    // count posts
    const postCount = await prisma.mod180_posts.count({
      where: {
        post_type: "post",
        post_status: "publish",
      },
    });

    const totalPages = Math.ceil(postCount / limit);

    return Response.json({
      perPage: limit,
      postCount,
      totalPages,
    });
  } catch (error) {
    return Response.json(serializeError(error), {
      status: 500,
    });
  }
}
