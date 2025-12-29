import prisma from "@/lib/prisma";
import authMiddleware from "@/lib/auth/authMiddleware";
import { NextRequest, NextResponse } from "next/server";
import moment from "moment";

/**
 * GET /api/(billing)/trial/status
 * Récupérer le statut de l'essai gratuit de l'utilisateur
 */
export async function GET(request: NextRequest) {
  return await authMiddleware(request, async (user) => {
    try {

    // Récupérer l'abonnement d'essai actif
    const trialSubscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        isTrial: true,
        trialEnd: { gte: new Date() }, // Essai non expiré
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!trialSubscription) {
      // Check if user has ever had a trial subscription
      const hasEverHadTrial = await prisma.subscription.findFirst({
        where: {
          userId: user.id,
          isTrial: true,
        },
      });

      return NextResponse.json({
        success: true,
        hasActiveTrial: false,
        canStartTrial: !hasEverHadTrial,
        message: hasEverHadTrial 
          ? "Vous avez déjà utilisé votre essai gratuit" 
          : "Aucun essai en cours",
      });
    }

    // Calculer les jours restants
    const now = moment();
    const trialEnd = moment(trialSubscription.trialEnd);
    const daysRemaining = Math.max(0, trialEnd.diff(now, 'days'));
    const hoursRemaining = Math.max(0, trialEnd.diff(now, 'hours'));

    // Déterminer le niveau de rappel
    let reminderLevel: "none" | "early" | "urgent" | "final" = "none";
    if (daysRemaining <= 1) {
      reminderLevel = "final";
    } else if (daysRemaining <= 3) {
      reminderLevel = "urgent";
    } else if (daysRemaining <= 5) {
      reminderLevel = "early";
    }

    return NextResponse.json({
      success: true,
      hasActiveTrial: true,
      trial: {
        id: trialSubscription.id,
        reference: trialSubscription.reference,
        planId: trialSubscription.planId,
        planTitle: trialSubscription.plan.title,
        trialStart: trialSubscription.trialStarted,
        trialEnd: trialSubscription.trialEnd,
        daysRemaining,
        hoursRemaining,
        reminderLevel,
        canConvert: true,
      },
      canStartTrial: false, // Déjà en essai
    });

    } catch (error) {
      console.error("Erreur lors de la récupération du statut d'essai:", error);
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