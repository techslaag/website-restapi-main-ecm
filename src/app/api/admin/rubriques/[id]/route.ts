import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/rubriques/[id]
 * Get specific rubrique by ID
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const rubrique = await prisma.rubrique.findUnique({
        where: { id: params.id }
      });

      if (!rubrique) {
        return Response.json(
          { error: "Rubrique not found" },
          { status: 404 }
        );
      }

      return Response.json({ rubrique });

    } catch (error) {
      console.error("Error fetching rubrique:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}

/**
 * PUT /api/admin/rubriques/[id]
 * Update specific rubrique
 */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const body = await request.json();
      const { name, slug, description, color, hasImageUrl, imageUrl, order, isActive, isDefault } = body;

      // Check if rubrique exists
      const existing = await prisma.rubrique.findUnique({
        where: { id: params.id }
      });

      if (!existing) {
        return Response.json(
          { error: "Rubrique not found" },
          { status: 404 }
        );
      }

      // If name is being changed, check for conflicts
      if (name && name !== existing.name) {
        const nameConflict = await prisma.rubrique.findFirst({
          where: {
            AND: [
              { name: name },
              { id: { not: params.id } }
            ]
          }
        });

        if (nameConflict) {
          return Response.json(
            { error: "A rubrique with this name already exists" },
            { status: 409 }
          );
        }
      }

      // If slug is being changed, check for conflicts
      if (slug && slug !== existing.slug) {
        const slugConflict = await prisma.rubrique.findFirst({
          where: {
            AND: [
              { slug: slug },
              { id: { not: params.id } }
            ]
          }
        });

        if (slugConflict) {
          return Response.json(
            { error: "A rubrique with this slug already exists" },
            { status: 409 }
          );
        }
      }

      // Generate slug if name is changed but slug is not provided
      const finalSlug = slug || (name && name !== existing.name ? 
        name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 
        existing.slug);

      const rubrique = await prisma.rubrique.update({
        where: { id: params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(finalSlug !== existing.slug && { slug: finalSlug }),
          ...(description !== undefined && { description }),
          ...(color !== undefined && { color }),
          ...(hasImageUrl !== undefined && { hasImageUrl }),
          ...(imageUrl !== undefined && { imageUrl }),
          ...(order !== undefined && { order }),
          ...(isActive !== undefined && { isActive }),
          ...(isDefault !== undefined && { isDefault }),
          updatedAt: new Date()
        }
      });

      return Response.json({
        rubrique,
        message: "Rubrique updated successfully"
      });

    } catch (error) {
      console.error("Error updating rubrique:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}

/**
 * DELETE /api/admin/rubriques/[id]
 * Delete specific rubrique
 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      // Check if rubrique exists
      const existing = await prisma.rubrique.findUnique({
        where: { id: params.id }
      });

      if (!existing) {
        return Response.json(
          { error: "Rubrique not found" },
          { status: 404 }
        );
      }

      // Check if it's a default rubrique
      if (existing.isDefault) {
        return Response.json(
          { error: "Cannot delete default rubrique" },
          { status: 400 }
        );
      }

      await prisma.rubrique.delete({
        where: { id: params.id }
      });

      return Response.json({
        message: "Rubrique deleted successfully"
      });

    } catch (error) {
      console.error("Error deleting rubrique:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}