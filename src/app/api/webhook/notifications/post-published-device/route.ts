import admin from "firebase-admin";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Vérifie si Firebase est déjà initialisé
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
    });
}

export async function POST(req: Request) {
    try {
        const { id, slug, title, content, categoryIds, categoryNames, testFcmToken } = await req.json();

        // 1️⃣ Récupérer les utilisateurs abonnés aux catégories de cet article
        // const users = await prisma.preference.findMany({
        //     where: {
        //         categories: {
        //             array_contains: categoryIds, // Vérifier si au moins une catégorie correspond
        //         },
        //     },
        //     select: { fcmToken: true },
        // });


        // 2️⃣ Construire la liste des tokens FCM
        // const fcmTokens = users.map((user) => user.fcmToken).filter(Boolean);
        // if (fcmTokens.length === 0) {
        //     return NextResponse.json({ message: "Aucun utilisateur concerné" });
        // }

        // const validTokens = fcmTokens.filter((token): token is string => token !== null);


        // if (validTokens.length === 0) {
        //     console.log("Aucun token FCM valide.");
        // } else {
            const message = {
                tokens: [testFcmToken], // Liste propre des tokens FCM
                notification: {
                    title: "Du nouveau dans "+categoryNames?.[0],
                    body: content,
                },
                data: { // 🔥 Ajout des données personnalisées
                    id: String(id), // Convertir en string pour éviter les erreurs
                    slug: slug, // Exemple de slug
                    type: 'article'
                },
            };
            const response = await admin.messaging().sendEachForMulticast(message);
            return NextResponse.json({
                message: "Notifications envoyées",
                successCount: response.successCount,
                failureCount: response.failureCount,
            });
            // 4️⃣ Envoyer les notifications via Firebase FCM
        // }

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}