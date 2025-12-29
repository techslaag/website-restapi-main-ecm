import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/centres-interet/categories
 * Get all interest categories from WordPress taxonomy
 */
export async function GET(request: Request) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const categories = await prisma.mod180_term_taxonomy.findMany({
        where: {
          taxonomy: 'category',
          term: {
            slug: {
              in: ['rubriques', 'zones-geographiques', 'autres']
            }
          }
        },
        include: {
          term: true,
          interests: {
            where: {
              isActive: true
            },
            orderBy: {
              name: 'asc'
            }
          }
        },
        orderBy: {
          term: {
            slug: 'asc'
          }
        }
      });

      return Response.json({
        categories: categories.map(cat => ({
          id: cat.term_taxonomy_id.toString(),
          name: cat.term?.name || '',
          slug: cat.term?.slug || '',
          description: cat.description,
          taxonomy: cat.taxonomy,
          interests: cat.interests.map(interest => ({
            id: interest.id,
            name: interest.name,
            slug: interest.slug,
            groupeId: interest.groupeId,
            isActive: interest.isActive,
          }))
        })),
        message: `${categories.length} catégories trouvées`
      });

    } catch (error) {
      console.error("Error fetching interest categories:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}