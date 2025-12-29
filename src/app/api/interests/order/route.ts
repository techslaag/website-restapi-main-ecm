import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import authMiddleware from "@/lib/auth/authMiddleware";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  return authMiddleware(request, async (user) => {
    try {
      const { interests } = await request.json();

      if (!Array.isArray(interests)) {
        return NextResponse.json(
          { error: "Format de données invalide" },
          { status: 400 }
        );
      }

      // Update the order for each interest
      const updatePromises = interests.map((interest: { id: string; order: number }) =>
        prisma.interest.update({
          where: { id: interest.id },
          data: { order: interest.order }
        })
      );

      await Promise.all(updatePromises);

      return NextResponse.json({
        message: "Ordre des centres d'intérêt mis à jour avec succès"
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'ordre des centres d'intérêt:", error);
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour de l'ordre des centres d'intérêt", details: error },
        { status: 500 }
      );
    }
  });
}

/**
 * @swagger
 * /interests/order:
 *   put:
 *     summary: Mettre à jour l'ordre des centres d'intérêt
 *     description: Permet de réorganiser l'ordre d'affichage des centres d'intérêt
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
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "clp1a2b3c4d5e6f7g8h9i0j1"
 *                     order:
 *                       type: number
 *                       example: 1
 *     responses:
 *       200:
 *         description: Ordre mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Ordre des centres d'intérêt mis à jour avec succès"
 *       400:
 *         description: Format de données invalide
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur
 */