import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

/**
 * PUT /api/admin/centres-interet/[id]
 * Update centre d'intérêt
 */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const body = await request.json();
      const { name, slug, description, groupeId, categoryId, icon, order, isActive, isDefault } = body;
      const { id } = params;

      if (!name) {
        return Response.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      // Check if the interest exists
      const existing = await prisma.interest.findUnique({
        where: { id }
      });

      if (!existing) {
        return Response.json(
          { error: "Centre d'intérêt non trouvé" },
          { status: 404 }
        );
      }

      // Generate slug if not provided
      const finalSlug = slug || name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Check if name or slug already exists (excluding current record)
      const conflict = await prisma.interest.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                { name: name },
                { slug: finalSlug }
              ]
            }
          ]
        }
      });

      if (conflict) {
        return Response.json(
          { error: "Un centre d'intérêt avec ce nom ou slug existe déjà" },
          { status: 409 }
        );
      }


      // Update centre d'intérêt
      const centreInteret = await prisma.interest.update({
        where: { id },
        data: {
          name,
          slug: finalSlug,
          description,
          groupeId,
          categoryId: categoryId ? BigInt(categoryId) : null,
          order: order !== undefined ? order : existing.order,
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
        message: "Centre d'intérêt mis à jour avec succès"
      });

    } catch (error) {
      console.error("Error updating centre d'intérêt:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}

/**
 * DELETE /api/admin/centres-interet/[id]
 * Delete centre d'intérêt
 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const { id } = params;

      // Check if the interest exists
      const existing = await prisma.interest.findUnique({
        where: { id }
      });

      if (!existing) {
        return Response.json(
          { error: "Centre d'intérêt non trouvé" },
          { status: 404 }
        );
      }

      // Check if there are users with this interest
      const userInterests = await prisma.userInterest.count({
        where: { interestId: id }
      });

      if (userInterests > 0) {
        return Response.json(
          { error: `Impossible de supprimer ce centre d'intérêt car ${userInterests} utilisateur(s) l'ont sélectionné` },
          { status: 400 }
        );
      }

      // Delete the interest
      await prisma.interest.delete({
        where: { id }
      });

      return Response.json({
        message: "Centre d'intérêt supprimé avec succès"
      });

    } catch (error) {
      console.error("Error deleting centre d'intérêt:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}