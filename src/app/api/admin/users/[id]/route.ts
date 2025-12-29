import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const userId = params.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscriptions: {
            include: {
              plan: {
                select: {
                  id: true,
                  title: true,
                  planType: true,
                  description: true,
                }
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      if (!user) {
        return Response.json(
          { error: "Utilisateur non trouvé" },
          { status: 404 }
        );
      }

      // Handle potential null plan relationships
      const userWithSanitizedSubscriptions = {
        ...user,
        subscriptions: user.subscriptions.map(subscription => ({
          ...subscription,
          plan: subscription.plan || null,
        })),
      };

      return Response.json(userWithSanitizedSubscriptions);
    } catch (error) {
      console.error("Error fetching user:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const userId = params.id;
      const body = await request.json();

      const {
        name,
        email,
        admin,
        emailVerified,
        locale,
      } = body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return Response.json(
          { error: "Utilisateur non trouvé" },
          { status: 404 }
        );
      }

      // Check if email is being changed and if it's already taken
      if (email && email !== existingUser.email) {
        const emailExists = await prisma.user.findFirst({
          where: {
            email: email,
            NOT: { id: userId },
          },
        });

        if (emailExists) {
          return Response.json(
            { error: "Cette adresse email est déjà utilisée" },
            { status: 400 }
          );
        }
      }

      // Prepare update data
      const updateData: any = {};
      
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (admin !== undefined) updateData.admin = admin;
      if (emailVerified !== undefined) {
        updateData.emailVerified = emailVerified ? new Date() : null;
      }
      if (locale !== undefined) updateData.locale = locale;
      
      updateData.updatedAt = new Date();

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: {
          subscriptions: {
            include: {
              plan: {
                select: {
                  id: true,
                  title: true,
                  planType: true,
                  description: true,
                }
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      });

      // Handle potential null plan relationships
      const userWithSanitizedSubscriptions = {
        ...updatedUser,
        subscriptions: updatedUser.subscriptions.map(subscription => ({
          ...subscription,
          plan: subscription.plan || null,
        })),
      };

      return Response.json({
        message: "Utilisateur mis à jour avec succès",
        user: userWithSanitizedSubscriptions,
      });
    } catch (error) {
      console.error("Error updating user:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const userId = params.id;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return Response.json(
          { error: "Utilisateur non trouvé" },
          { status: 404 }
        );
      }

      // Prevent deleting admin users
      if (existingUser.admin) {
        return Response.json(
          { error: "Impossible de supprimer un administrateur" },
          { status: 400 }
        );
      }

      // Delete related records that don't have cascade delete
      // Note: Records with onDelete: Cascade will be deleted automatically
      
      // 1. Delete AbandonedSubscriptions first (they may reference subscriptions)
      await prisma.abandonedSubscription.deleteMany({
        where: { userId },
      });
      
      // 2. Delete EmailLogs
      await prisma.emailLog.deleteMany({
        where: { userId },
      });
      
      // 3. Delete EmailJobs  
      await prisma.emailJob.deleteMany({
        where: { userId },
      });
      
      // 4. Delete Purchases
      await prisma.purchase.deleteMany({
        where: { userId },
      });
      
      // 5. Delete Subscriptions  
      await prisma.subscription.deleteMany({
        where: { userId },
      });
      
      // 6. Delete UserNewsletters
      await prisma.userNewsletter.deleteMany({
        where: { userId },
      });
      
      // 7. Delete UserProfile
      await prisma.userProfile.deleteMany({
        where: { userId },
      });
      
      // 8. Delete Payments (should be done after subscriptions/purchases)
      await prisma.payment.deleteMany({
        where: { userId },
      });
      
      // 9. Finally, delete the user (cascade deletes will handle remaining relations)
      await prisma.user.delete({
        where: { id: userId },
      });

      return Response.json({
        message: "Utilisateur supprimé avec succès",
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}