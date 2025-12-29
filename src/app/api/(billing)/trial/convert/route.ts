import prisma from "@/lib/prisma";
import authMiddleware from "@/lib/auth/authMiddleware";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Schéma de validation pour convertir un essai
const TrialConvertSchema = z.object({
  subscriptionId: z.string().cuid("ID d'abonnement invalide"),
  paymentId: z.string().cuid("ID de paiement invalide"),
  period: z.enum(["month", "year"]).optional(),
});

/**
 * POST /api/(billing)/trial/convert
 * Convertir un essai gratuit en abonnement payant
 */
export async function POST(request: NextRequest) {
  return await authMiddleware(request, async (user) => {
    try {

    // Validation des données
    const body = await request.json();
    const validationResult = TrialConvertSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Données invalides",
          errors: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const { subscriptionId, paymentId, period } = validationResult.data;

    // Récupérer l'abonnement d'essai
    const trialSubscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId: user.id,
        isTrial: true,
        trialConvertedAt: null, // Pas encore converti
      },
      include: {
        plan: true,
      },
    });

    if (!trialSubscription) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Abonnement d'essai non trouvé ou déjà converti" 
        },
        { status: 404 }
      );
    }

    // Vérifier que le paiement existe et appartient à l'utilisateur
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        userId: user.id,
        status: "succeeded",
      },
    });

    if (!payment) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Paiement non trouvé ou non validé" 
        },
        { status: 404 }
      );
    }

    // Calculer la nouvelle date d'expiration
    const plan = trialSubscription.plan;
    const selectedPeriod = period || "month";
    const currentDate = new Date();
    
    let newExpiryDate: Date;
    if (selectedPeriod === "year") {
      newExpiryDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + 1));
    } else {
      newExpiryDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
    }

    // Convertir l'essai en abonnement payant
    const convertedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        isTrial: false,
        trialConvertedAt: new Date(),
        paymentId: payment.id,
        period: selectedPeriod,
        expiresAt: newExpiryDate,
      },
      include: {
        plan: true,
        payment: true,
      },
    });

    // Mettre à jour le paiement pour lier l'abonnement
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        subscriptions: {
          connect: { id: subscriptionId }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: "Essai converti en abonnement premium avec succès",
      subscription: {
        id: convertedSubscription.id,
        reference: convertedSubscription.reference,
        planTitle: plan.title,
        period: convertedSubscription.period,
        expiresAt: convertedSubscription.expiresAt,
        trialConvertedAt: convertedSubscription.trialConvertedAt,
      },
      redirectUrl: "/member/dashboard?converted=true",
    });

    } catch (error) {
      console.error("Erreur lors de la conversion de l'essai:", error);
      return NextResponse.json(
        { 
          success: false, 
          message: "Erreur interne du serveur" 
        },
        { status: 500 }
      );
    }
  });
}