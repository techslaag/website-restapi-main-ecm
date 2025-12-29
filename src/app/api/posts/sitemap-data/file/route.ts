import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { NextRequest } from "next/server";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const queryParams: { page: string; limit: string } =
      extractQueryParams(req);

    const page = Number(queryParams.page ?? 1);
    const limit = Number(queryParams.limit ?? 25000);
    const skip = (page - 1) * limit;

    // fetch posts
    const posts = await prisma.mod180_posts.findMany({
      where: {
        post_type: "post",
        post_status: "publish",
      },
      skip,
      take: limit,
      select: {
        ID: true,
        post_name: true,
        post_modified: true,
        post_modified_gmt: true,
      },
    });

    return Response.json(toSafeJSON(posts));
  } catch (error) {
    return Response.json(serializeError(error), {
      status: 500,
    });
  }
}
