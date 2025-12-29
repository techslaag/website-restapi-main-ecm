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

// export async function POST(req: Request) {
//     try {
//         const body = await req.json();
//         const { id, title, content } = body;

//         const message = {
//             notification: {
//                 title: "Nouvel article publié !",
//                 body: title,
//             },
//             data: {
//                 postId: id.toString(),
//                 content: content.substring(0, 100),
//             },
//             // topic: "blog-news",
//             token: "fpRfBzaySxewy5ybKO9fGN:APA91bFZf4Ry1ZcZasXGgG1Y3fE6SRAN5obnC7NZwGpoBp5LC38Z62-Yy48e18wxN0owW85uC6oq0AVqLD_Q253S-LRaijvK2P9KHRs028lWp9P9KJ8k7_A",
//         };

//         // await admin.messaging().send(message);

//         const response = await admin.messaging().send(message);
//         console.log("Notification envoyée avec ID :", response);

//         return NextResponse.json({ message: "Notification envoyée", response: response }, { status: 200 });
//     } catch (error) {
//         console.error("Erreur lors de l'envoi de la notification :", error);
//         return NextResponse.json({ message: "Erreur interne du serveur" }, { status: 500 });
//     }
// }

export async function POST(req: Request) {
    try {
        const { id, slug, title, content, categoryIds, categoryNames } = await req.json();

        // 1️⃣ Récupérer les utilisateurs abonnés aux catégories de cet article
        const allPreferences = await prisma.preference.findMany({
            where: {
                fcmToken: { not: null } // Only get users with FCM tokens
            },
            select: { fcmToken: true, categories: true },
        });

        // Filter preferences that contain any of the categoryIds
        const matchingUsers = allPreferences.filter(pref => {
            try {
                const userCategories = JSON.parse(pref.categories) as string[];
                return categoryIds.some((catId: string) => userCategories.includes(catId));
            } catch (error) {
                console.error("Error parsing categories JSON:", error);
                return false;
            }
        });


        // 2️⃣ Construire la liste des tokens FCM
        const fcmTokens = matchingUsers.map((user) => user.fcmToken).filter(Boolean);
        if (fcmTokens.length === 0) {
            return NextResponse.json({ message: "Aucun utilisateur concerné" });
        }

        const validTokens = fcmTokens.filter((token): token is string => token !== null);

        if (validTokens.length === 0) {
            console.log("Aucun token FCM valide.");
        } else {
            const message = {
                tokens: validTokens, // Liste propre des tokens FCM
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
        }

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}