import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from "zod";

// Définir un schéma de validation pour le package
const PackageType = z.enum(['PREMIUM', 'PARTENAIRE', 'SOUTIENT']);

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json(); // Récupérer le corps de la requête
    console.log("Corps de la requête PUT:", body);

    // Valider le corps de la requête
    const validatedData = z.object({
      package: PackageType, // Validation du package
    }).parse(body); // Validation avec zod

    const { package: packageType } = validatedData; // Extraire le package validé


    return NextResponse.json("undefined", { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du package:", error);

    // Gestion des erreurs de validation
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    
    // Gestion des erreurs liées à Prisma ou d'autres erreurs internes
    return NextResponse.json({ error: "Erreur lors de la mise à jour du package" }, { status: 500 });
  }
}
