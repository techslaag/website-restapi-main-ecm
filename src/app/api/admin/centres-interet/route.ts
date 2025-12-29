import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/centres-interet
 * Get all centres d'intérêt (interests) with pagination and filtering
 */
export async function GET(request: Request) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '10');
      const search = searchParams.get('search') || '';
      const groupeId = searchParams.get('groupeId') || '';
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
      
      if (groupeId) {
        where.groupeId = groupeId;
      }
      
      if (isActive !== null) {
        where.isActive = isActive === 'true';
      }

      // Get total count for pagination
      const total = await prisma.interest.count({ where });
      
      // Get centres d'intérêt with pagination
      const interests = await prisma.interest.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: {
            include: {
              term: true
            }
          }
        },
        orderBy: [
          { groupeId: 'asc' },
          { order: 'asc' },
          { name: 'asc' }
        ]
      });

      // Transform to match frontend expectations
      const centresInteret = interests.map(interest => ({
        id: interest.id,
        name: interest.name,
        slug: interest.slug,
        description: interest.description,
        categoryId: interest.categoryId ? interest.categoryId.toString() : null,
        groupeId: interest.groupeId,
        category: interest.category ? {
          id: interest.category.term_taxonomy_id.toString(),
          name: interest.category.term?.name || '',
          slug: interest.category.term?.slug || '',
          taxonomy: interest.category.taxonomy,
        } : null,
        icon: 'Heart', // Default icon since it's not in schema
        order: interest.order, // Use actual database order value
        isActive: interest.isActive,
        isDefault: false, // Default value since it's not in schema
        createdAt: interest.createdAt.toISOString(),
        updatedAt: interest.updatedAt.toISOString(),
      }));

      return Response.json({
        centresInteret,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: skip + limit < total,
          hasPrev: page > 1
        },
        message: `${centresInteret.length} centres d'intérêt trouvés`
      });

    } catch (error) {
      console.error("Error fetching centres d'intérêt:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}

/**
 * POST /api/admin/centres-interet
 * Create new centre d'intérêt
 */
export async function POST(request: Request) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const body = await request.json();
      const { name, slug, description, groupeId, categoryId, icon, order, isActive, isDefault } = body;

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
      const existing = await prisma.interest.findFirst({
        where: {
          OR: [
            { name: name },
            { slug: finalSlug }
          ]
        }
      });

      if (existing) {
        return Response.json(
          { error: "Un centre d'intérêt avec ce nom ou slug existe déjà" },
          { status: 409 }
        );
      }

      // Create new centre d'intérêt
      const centreInteret = await prisma.interest.create({
        data: {
          name,
          slug: finalSlug,
          description,
          groupeId,
          categoryId: categoryId ? BigInt(categoryId) : null,
          order: order || 0,
          isActive: isActive ?? true,
        },
        include: {
          category: {
            include: {
              term: true
            }
          }
        }
      });

      return Response.json({
        centreInteret: {
          id: centreInteret.id,
          name: centreInteret.name,
          slug: centreInteret.slug,
          description: centreInteret.description,
          groupeId: centreInteret.groupeId,
          categoryId: centreInteret.categoryId ? centreInteret.categoryId.toString() : null,
          category: centreInteret.category ? {
            id: centreInteret.category.term_taxonomy_id.toString(),
            name: centreInteret.category.term?.name || '',
            slug: centreInteret.category.term?.slug || '',
            taxonomy: centreInteret.category.taxonomy,
          } : null,
          icon: icon || 'Heart',
          order: centreInteret.order,
          isActive: centreInteret.isActive,
          isDefault: isDefault || false,
          createdAt: centreInteret.createdAt.toISOString(),
          updatedAt: centreInteret.updatedAt.toISOString(),
        },
        message: "Centre d'intérêt créé avec succès"
      });

    } catch (error) {
      console.error("Error creating centre d'intérêt:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}