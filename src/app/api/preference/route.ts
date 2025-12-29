import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const { userId, categoryIds, fcmToken } = await req.json();

        // Validate userId
        if (!userId || typeof userId !== 'string') {
            return NextResponse.json({ error: "userId est requis" }, { status: 400 });
        }

        // Check if user exists
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            console.log(`User not found: ${userId}`);
            return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
        }

        // Convert categoryIds array to JSON string for storage
        const categoriesJson = Array.isArray(categoryIds)
            ? JSON.stringify(categoryIds)
            : (typeof categoryIds === 'string' ? categoryIds : '[]');

        // Vérifier si une préférence existe déjà
        const existing = await prisma.preference.findUnique({ where: { userId } });

        if (existing) {
            await prisma.preference.update({
                where: { userId },
                data: { categories: categoriesJson, fcmToken },
            });

            return NextResponse.json({ message: "Préférences Mise à jour" });

        } else {
            await prisma.preference.create({
                data: { userId, categories: categoriesJson, fcmToken },
            });
        }

        return NextResponse.json({ message: "Préférences enregistrées" });
    } catch (error) {
        console.error("Error saving preferences:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}

