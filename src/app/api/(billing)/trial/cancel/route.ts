import prisma from "@/lib/prisma";
import authMiddleware from "@/lib/auth/authMiddleware";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Schéma de validation pour annuler un essai
const TrialCancelSchema = z.object({
  subscriptionId: z.string().cuid("ID d'abonnement invalide"),
  reason: z.string().optional(),
});

/**
 * POST /api/(billing)/trial/cancel
 * Annuler un essai gratuit avant la fin
 */
export async function POST(request: NextRequest) {
  return await authMiddleware(request, async (user) => {
    try {

    // Validation des données
    const body = await request.json();
    const validationResult = TrialCancelSchema.safeParse(body);
    
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

    const { subscriptionId, reason } = validationResult.data;

    // Récupérer l'abonnement d'essai
    const trialSubscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId: user.id,
        isTrial: true,
        trialEnd: { gte: new Date() }, // Encore actif
      },
      include: {
        plan: true,
      },
    });

    if (!trialSubscription) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Abonnement d'essai non trouvé ou déjà expiré" 
        },
        { status: 404 }
      );
    }

    // Annuler l'essai en mettant la date d'expiration à maintenant
    const cancelledSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        expiresAt: new Date(), // Expire immédiatement
        trialEnd: new Date(), // Fin d'essai immédiate
        updatedAt: new Date(),
      },
      include: {
        plan: true,
      },
    });

    // Log de l'annulation (optionnel - créer une table de logs si nécessaire)
    console.log(`Essai annulé - Utilisateur: ${user.id}, Abonnement: ${subscriptionId}, Raison: ${reason || 'Non spécifiée'}`);

    return NextResponse.json({
      success: true,
      message: "Essai annulé avec succès",
      subscription: {
        id: cancelledSubscription.id,
        reference: cancelledSubscription.reference,
        planTitle: cancelledSubscription.plan.title,
        cancelledAt: new Date(),
        reason: reason || null,
      },
      redirectUrl: "/",
    });

    } catch (error) {
      console.error("Erreur lors de l'annulation de l'essai:", error);
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