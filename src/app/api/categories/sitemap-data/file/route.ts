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

    // fetch categories - matching the main categories route behavior
    const categories = await prisma.mod180_term_taxonomy.findMany({
      where: {
        taxonomy: "category",
      },
      skip,
      take: limit,
      select: {
        term_taxonomy_id: true,
        term: {
          select: {
            term_id: true,
            slug: true,
            name: true,
          }
        }
      },
      orderBy: {
        term: {
          name: "asc"
        }
      }
    });

    // Transform to match sitemap requirements
    const transformedCategories = categories.map(cat => ({
      ID: cat.term_taxonomy_id,
      name: cat.term.name,
      slug: cat.term.slug,
    }));

    return Response.json(toSafeJSON(transformedCategories));
  } catch (error) {
    return Response.json(serializeError(error), {
      status: 500,
    });
  }
}