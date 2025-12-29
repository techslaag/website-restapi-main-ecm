import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: userId } }: { params: { id: string } },
) {
  try {
    // Vérification du userId
    if (!userId) {
      return NextResponse.json({ error: "userId requis" }, { status: 400 });
    }

    // Récupération des préférences
    const preferences = await prisma.preference.findUnique({
      where: { userId },
    });

    // Séparation des ID valides et non valides
    const categoryIds = Array.isArray(preferences?.categories) ? preferences.categories : [];

    const validCategoryIds: bigint[] = [];
    const invalidCategoryIds: string[] = [];

    categoryIds.forEach((id: any) => {
      if (!isNaN(id) && Number.isInteger(Number(id))) {
        validCategoryIds.push(BigInt(id));
      } else {
        invalidCategoryIds.push(id);
      }
    });

    // Si aucune catégorie, renvoyer une réponse vide
    if (validCategoryIds.length === 0 && invalidCategoryIds.length === 0) {
      return NextResponse.json({ categories: [] }, { status: 200 });
    }

    // Récupération des détails des catégories valides
    const categories = validCategoryIds.length
      ? await prisma.mod180_term_taxonomy.findMany({
          where: {
            taxonomy: "category",
            term_id: { in: validCategoryIds },
          },
          select: {
            term_id: true,
            description: true,
            term: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        })
      : [];

    // Convertir les BigInt en string pour la sérialisation JSON
    const serializedCategories = categories.map((cat) => ({
      ...cat,
      term_id: cat.term_id.toString(),
    }));

    // Réponse avec les catégories valides et les IDs invalides
    return NextResponse.json(
      {
        success: serializedCategories,
        invalidCategories: invalidCategoryIds,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Erreur serveur :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
