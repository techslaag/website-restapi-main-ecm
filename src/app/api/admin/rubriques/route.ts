import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/rubriques
 * Get all rubriques with pagination and filtering
 */
export async function GET(request: Request) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '10');
      const search = searchParams.get('search') || '';
      const isActive = searchParams.get('isActive');
      
      const skip = (page - 1) * limit;
      
      // Build where clause
      const where: any = {};
      
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { slug: { contains: search } },
          { description: { contains: search } }
        ];
      }
      
      if (isActive !== null) {
        where.isActive = isActive === 'true';
      }

      // Get total count for pagination
      const total = await prisma.rubrique.count({ where });
      
      // Get rubriques with pagination
      const rubriques = await prisma.rubrique.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { order: 'asc' },
          { name: 'asc' }
        ]
      });

      return Response.json({
        rubriques,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: skip + limit < total,
          hasPrev: page > 1
        },
        message: `${rubriques.length} rubriques found`
      });

    } catch (error) {
      console.error("Error fetching rubriques:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}

/**
 * POST /api/admin/rubriques
 * Create new rubrique
 */
export async function POST(request: Request) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const body = await request.json();
      const { name, slug, description, color, hasImageUrl, imageUrl, order, isActive, isDefault } = body;

      if (!name) {
        return Response.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      // Generate slug if not provided
      const finalSlug = slug || name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Check if name or slug already exists
      const existing = await prisma.rubrique.findFirst({
        where: {
          OR: [
            { name: name },
            { slug: finalSlug }
          ]
        }
      });

      if (existing) {
        return Response.json(
          { error: "A rubrique with this name or slug already exists" },
          { status: 409 }
        );
      }

      const rubrique = await prisma.rubrique.create({
        data: {
          name,
          slug: finalSlug,
          description,
          color,
          hasImageUrl: hasImageUrl || false,
          imageUrl,
          order: order || 0,
          isActive: isActive !== undefined ? isActive : true,
          isDefault: isDefault || false
        }
      });

      return Response.json({
        rubrique,
        message: "Rubrique created successfully"
      });

    } catch (error) {
      console.error("Error creating rubrique:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}