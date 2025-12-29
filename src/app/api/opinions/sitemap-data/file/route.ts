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
    const offset = (page - 1) * limit;

    // fetch opinions using raw query to match the main opinions route ordering
    const opinionsRaw = await prisma.$queryRaw<{
      ID: number;
      post_name: string;
      post_modified: Date;
      post_modified_gmt: Date;
    }[]>`
      SELECT DISTINCT p.ID, p.post_name, p.post_modified, p.post_modified_gmt
      FROM mod180_posts p
      INNER JOIN mod180_postmeta pm_type ON p.ID = pm_type.post_id 
        AND pm_type.meta_key = 'post_type' 
        AND pm_type.meta_value = 'opinion'
      LEFT JOIN mod180_postmeta pm_pos ON p.ID = pm_pos.post_id 
        AND pm_pos.meta_key = 'position'
      WHERE p.post_type = 'post' 
        AND p.post_status = 'publish'
      ORDER BY COALESCE(CAST(pm_pos.meta_value AS SIGNED), 0) DESC, p.post_date_gmt DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Transform to match the expected format
    const opinions = opinionsRaw.map(opinion => ({
      ID: opinion.ID,
      post_name: opinion.post_name,
      post_modified: opinion.post_modified,
      post_modified_gmt: opinion.post_modified_gmt,
    }));

    return Response.json(toSafeJSON(opinions));
  } catch (error) {
    return Response.json(serializeError(error), {
      status: 500,
    });
  }
}