import { NextResponse } from "next/server";
import authMiddleware from "@/lib/auth/authMiddleware";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET - Récupérer les centres d'intérêt de l'utilisateur connecté
export async function GET(request: Request) {
  return authMiddleware(request, async (user) => {
    try {
      console.log("GET interests for user:", user.id, user.email);
      
      // Get all user interests first, then filter for valid ones
      const allUserInterests = await prisma.userInterest.findMany({
        where: { userId: user.id },
        include: {
          interest: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              categoryId: true,
              groupeId: true
            }
          }
        }
      });
      
      // Filter out records where interest is null (deleted interests)
      const userInterests = allUserInterests.filter(ui => ui.interest !== null);

      console.log(`Found ${userInterests.length} valid interests (${allUserInterests.length} total)`);
      
      // Retourner les IDs des centres d'intérêt
      const interestIds = userInterests.map(ui => ui.interestId);
      const details = userInterests.map(ui => ({
        ...ui.interest,
        // Convert any BigInt values to strings for JSON serialization
        categoryId: ui.interest.categoryId ? String(ui.interest.categoryId) : null,
        groupeId: ui.interest.groupeId ? String(ui.interest.groupeId) : null
      }));
      
      const response = { 
        interests: interestIds,
        details: details
      };
      
      console.log(`API Response: ${response.interests.length} interests returned`);
      
      return NextResponse.json(response);
    } catch (error) {
      console.error("Erreur lors de la récupération des centres d'intérêt:", error);
      return NextResponse.json(
        { error: "Erreur serveur" },
        { status: 500 }
      );
    }
  });
}

// PUT - Mettre à jour les centres d'intérêt de l'utilisateur
export async function PUT(request: Request) {
  return authMiddleware(request, async (user) => {
    try {
      const { interests } = await request.json();

      if (!Array.isArray(interests)) {
        return NextResponse.json(
          { error: "Format invalide: interests doit être un tableau" },
          { status: 400 }
        );
      }

      console.log("Updating interests for user:", user.id);
      console.log("Interests to save:", interests);

      // Transaction pour mettre à jour les centres d'intérêt
      await prisma.$transaction(async (tx) => {
        // Supprimer tous les centres d'intérêt existants de l'utilisateur
        const deleteResult = await tx.userInterest.deleteMany({
          where: { userId: user.id }
        });
        console.log("Deleted existing interests:", deleteResult);

        // Ajouter les nouveaux centres d'intérêt
        if (interests.length > 0) {
          // Verify interests exist before creating relationships
          const validInterests = await tx.interest.findMany({
            where: {
              id: {
                in: interests
              }
            },
            select: { id: true }
          });
          
          const validInterestIds = validInterests.map(i => i.id);
          console.log("Valid interest IDs:", validInterestIds);
          
          if (validInterestIds.length > 0) {
            const createResult = await tx.userInterest.createMany({
              data: validInterestIds.map(interestId => ({
                userId: user.id,
                interestId: interestId
              }))
            });
            console.log("Created new interests:", createResult);
          } else {
            console.warn("No valid interests found to create");
          }
        }
      });

      // Récupérer les centres d'intérêt mis à jour (valid interests only)
      const allUpdatedInterests = await prisma.userInterest.findMany({
        where: { userId: user.id },
        include: {
          interest: true
        }
      });
      
      const updatedInterests = allUpdatedInterests.filter(ui => ui.interest !== null);

      return NextResponse.json({ 
        message: "Centres d'intérêt mis à jour avec succès",
        interests: updatedInterests.map(ui => ui.interestId)
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour des centres d'intérêt:", error);
      return NextResponse.json(
        { error: "Erreur serveur" },
        { status: 500 }
      );
    }
  });
}

/**
 * @swagger
 * /users/interests:
 *   get:
 *     summary: Récupérer les centres d'intérêt de l'utilisateur connecté
 *     description: Nécessite une authentification
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Centres d'intérêt de l'utilisateur
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 interests:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Non autorisé
 *   put:
 *     summary: Mettre à jour les centres d'intérêt de l'utilisateur
 *     description: Nécessite une authentification
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Centres d'intérêt mis à jour
 *       400:
 *         description: Format invalide
 *       401:
 *         description: Non autorisé
 */