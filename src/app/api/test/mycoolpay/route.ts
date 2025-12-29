import prisma from "@/lib/prisma";
import { NextRequest } from "next/server";
import { sign } from "jsonwebtoken";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

/**
 * Test endpoint pour MyCoolPay - Crée un utilisateur de test et retourne un token
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier que c'est un environnement de développement
    if (process.env.NODE_ENV === 'production') {
      return Response.json({ message: "Endpoint de test non disponible en production" }, { status: 403 });
    }

    // Créer ou récupérer un utilisateur de test
    const testEmail = "test.mycoolpay@ecomatin.net";
    const testPassword = "Test123456!";
    
    let user = await prisma.user.findUnique({
      where: { email: testEmail }
    });

    if (!user) {
      // Créer l'utilisateur de test
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      
      user = await prisma.user.create({
        data: {
          email: testEmail,
          name: "Test MyCoolPay User",
          password: hashedPassword,
          emailVerified: new Date(),
          admin: false,
        }
      });

      console.log("✅ Utilisateur de test créé:", user.id, user.email);
    }

    // Créer un token JWT
    const tokenPayload = {
      id: user.id,
      email: user.email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // Expire dans 24h
    };

    const token = sign(tokenPayload, process.env.JWT_SECRET!);

    // Supprimer les anciennes sessions de test
    await prisma.session.deleteMany({
      where: { userId: user.id }
    });

    // Créer une nouvelle session
    await prisma.session.create({
      data: {
        sessionToken: token,
        userId: user.id,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        userAgent: "Test-MyCoolPay-Client/1.0",
        userIpAddress: "192.168.1.100",
      }
    });

    // Récupérer un plan existant (n'importe lequel)
    let plan = await prisma.plan.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    if (!plan) {
      return Response.json({
        success: false,
        message: "Aucun plan trouvé en base de données. Veuillez créer un plan d'abord."
      }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: "Utilisateur et plan de test créés/récupérés avec succès",
      testData: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        plan: {
          id: plan.id,
          title: plan.title,
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice
        },
        token: token,
        testPayload: {
          planId: plan.id,
          billingPeriod: "month",
          phoneNumber: "+237655555555",
          userIp: "192.168.1.1"
        }
      }
    });

  } catch (error) {
    console.error("❌ Erreur lors de la création de l'utilisateur de test:", error);
    return Response.json(
      { 
        success: false, 
        message: "Erreur lors de la création de l'utilisateur de test",
        error: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}

/**
 * Cleanup endpoint - supprime les données de test
 */
export async function DELETE(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return Response.json({ message: "Endpoint de test non disponible en production" }, { status: 403 });
    }

    const testEmail = "test.mycoolpay@ecomatin.net";
    
    // Supprimer l'utilisateur de test et toutes ses données associées
    const user = await prisma.user.findUnique({
      where: { email: testEmail }
    });

    if (user) {
      // Supprimer les sessions
      await prisma.session.deleteMany({
        where: { userId: user.id }
      });

      // Supprimer les paiements
      await prisma.payment.deleteMany({
        where: { userId: user.id }
      });

      // Supprimer l'utilisateur
      await prisma.user.delete({
        where: { id: user.id }
      });

      console.log("🗑️  Utilisateur de test supprimé:", user.email);
    }

    // Supprimer les plans de test
    await prisma.plan.deleteMany({
      where: { title: { contains: "Test MyCoolPay" } }
    });

    return Response.json({
      success: true,
      message: "Données de test nettoyées avec succès"
    });

  } catch (error) {
    console.error("❌ Erreur lors du nettoyage:", error);
    return Response.json(
      { 
        success: false, 
        message: "Erreur lors du nettoyage",
        error: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}