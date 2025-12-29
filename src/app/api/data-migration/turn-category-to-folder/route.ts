import prisma from "@/lib/prisma";
import { extractQueryParams, isNumeric } from "@/lib/utils/index";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // extract request query params
  const queryParms: { idOrSlug?: string } = extractQueryParams(req);

  const categories = await prisma.mod180_term_taxonomy.findMany({
    where: {
      taxonomy: "category",
      AND: [
        isNumeric(queryParms.idOrSlug)
          ? {
              term: {
                term_id: Number(queryParms.idOrSlug),
              },
            }
          : {
              term: {
                slug: queryParms.idOrSlug,
              },
            },
      ],
    },
    include: {
      term: true,
    },
  });

  if (categories) {
    const result = await prisma.mod180_term_taxonomy.updateMany({
      where: {
        taxonomy: "category",
        AND: [
          isNumeric(queryParms.idOrSlug)
            ? {
                term: {
                  term_id: Number(queryParms.idOrSlug),
                },
              }
            : {
                term: {
                  slug: queryParms.idOrSlug,
                },
              },
        ],
      },
      data: {
        taxonomy: "affair",
      },
    });

    return Response.json({
      success: true,
      ...result,
      updatedAt: new Date(),
    });
  } else {
    return Response.json({ message: "Category not found." }, { status: 404 });
  }
}
