import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Validation schema for user updates
const updateUserSchema = z.object({
  name: z.string().min(1, "Le nom est requis").optional(),
  email: z.string().email("Email invalide").optional(),
  admin: z.boolean().optional(),
});

// GET single user by ID
export async function GET(request: Request, { params }: { params: { id: string } }) {
  return adminMiddleware(request, async () => {
    try {
      const userId = params.id;

      if (!userId) {
        return errorResponse("User ID is required", { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscriptions: {
            orderBy: {
              createdAt: "desc",
            },
            include: {
              plan: true,
              payment: true,
            },
          },
        },
      });

      if (!user) {
        return errorResponse("User not found", { status: 404 });
      }

      return Response.json(user, { status: 200 });
    } catch (error) {
      console.error("Error fetching user:", error);
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}

// PUT update user
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const userId = params.id;

      if (!userId) {
        return errorResponse("User ID is required", { status: 400 });
      }

      const body = await requestJsonBody(request);
      const updateData = updateUserSchema.parse(body);

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return errorResponse("User not found", { status: 404 });
      }

      // If updating email, check it's not already taken
      if (updateData.email && updateData.email !== existingUser.email) {
        const emailExists = await prisma.user.findUnique({
          where: { email: updateData.email },
        });

        if (emailExists) {
          return errorResponse("Cette adresse email est déjà utilisée", { status: 400 });
        }
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
        include: {
          subscriptions: {
            orderBy: {
              createdAt: "desc",
            },
            include: {
              plan: true,
              payment: true,
            },
          },
        },
      });

      return Response.json({
        message: "Utilisateur mis à jour avec succès",
        user: updatedUser,
      }, { status: 200 });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse("Données invalides: " + error.errors.map(e => e.message).join(", "), { status: 400 });
      }
      console.error("Error updating user:", error);
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}

// DELETE user
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const userId = params.id;

      if (!userId) {
        return errorResponse("User ID is required", { status: 400 });
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscriptions: true,
        },
      });

      if (!existingUser) {
        return errorResponse("User not found", { status: 404 });
      }

      // Check if user has active subscriptions
      const activeSubscriptions = existingUser.subscriptions.filter(sub => 
        new Date(sub.expiresAt) > new Date()
      );

      if (activeSubscriptions.length > 0) {
        return errorResponse(
          "Impossible de supprimer un utilisateur avec des abonnements actifs", 
          { status: 400 }
        );
      }

      // Delete user (cascade will handle related records)
      await prisma.user.delete({
        where: { id: userId },
      });

      return Response.json({
        message: "Utilisateur supprimé avec succès",
      }, { status: 200 });

    } catch (error) {
      console.error("Error deleting user:", error);
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}