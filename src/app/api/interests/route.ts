import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Récupérer tous les centres d'intérêt actifs depuis la base de données
    const interests = await prisma.interest.findMany({
      where: { isActive: true },
      orderBy: [
        { groupeId: 'asc' },
        { order: 'asc' },
        { name: 'asc' }
      ],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        categoryId: true,
        groupeId: true,
        order: true,
        isActive: true
      }
    });

    // Transform to match frontend interface expectations
    const transformedInterests = interests.map(interest => ({
      id: interest.id,
      name: interest.name,
      slug: interest.slug,
      description: interest.description,
      categoryId: interest.groupeId || 'autres', // Use groupeId as categoryId for compatibility
      groupeId: interest.groupeId || 'autres', // Also include explicit groupeId
      order: interest.order,
      isActive: interest.isActive
    }));

    return NextResponse.json(transformedInterests);
  } catch (error) {
    console.error("Erreur lors de la récupération des centres d'intérêt:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des centres d'intérêt", details: error },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /interests:
 *   get:
 *     summary: Récupérer la liste des centres d'intérêt
 *     description: Retourne tous les centres d'intérêt disponibles pour la personnalisation utilisateur
 *     responses:
 *       200:
 *         description: Liste des centres d'intérêt
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "1"
 *                   name:
 *                     type: string
 *                     example: "Banques et Finance"
 *                   slug:
 *                     type: string
 *                     example: "banques-finance"
 *                   categoryId:
 *                     type: string
 *                     example: "eco"
 *                   isActive:
 *                     type: boolean
 *                     example: true
 *       500:
 *         description: Erreur serveur
 */