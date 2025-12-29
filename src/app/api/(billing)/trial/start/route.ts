import prisma from "@/lib/prisma";
import { verify } from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import moment from "moment";
import { buildTrialStartedEmail } from "@/lib/mail/emails/buildTrialStartedEmail";
import { sendEmail } from "@/lib/mail";
import { z } from "zod";
import getCountryByIp from "@/lib/freeipapi/getCountryByIp";

// Schéma de validation pour démarrer un essai
const TrialStartSchema = z.object({
  planId: z.string().cuid("Plan ID invalide"),
  period: z.enum(["week", "month", "year"]).optional().default("week"), // Default to week for trials
});

/**
 * POST /api/(billing)/trial/start
 * Démarrer un essai gratuit pour un utilisateur
 */
export async function POST(request: NextRequest) {
  try {
    console.log("Trial start endpoint called");
    
    // Authentication
    const authHeader = request.headers.get("authorization");
    const token = authHeader ? authHeader.split(" ")[1] : undefined;
    console.log("Token provided:", !!token);

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Vous devez être connecté pour démarrer un essai gratuit" },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const payload = verify(token, process.env.JWT_SECRET!) as { id: string };
      userId = payload.id;
      console.log("Token verified for user:", userId);
    } catch (error) {
      console.log("Token verification failed:", error);
      return NextResponse.json(
        { success: false, message: "Votre session a expiré. Veuillez vous reconnecter." },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    console.log("User authenticated:", user.id, user.email);

    // Validation des données
    const body = await request.json();
    console.log("Request body:", body);
    
    const validationResult = TrialStartSchema.safeParse(body);
    console.log("Validation result:", validationResult.success ? "valid" : "invalid");
    
    if (!validationResult.success) {
      console.log("Validation errors:", validationResult.error.errors);
      return NextResponse.json(
        { 
          success: false, 
          message: "Le plan sélectionné n'est pas valide. Veuillez rafraîchir la page et réessayer.",
          errors: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const { planId, period } = validationResult.data;
    console.log("Plan ID:", planId, "Period:", period);

    // Récupérer l'IP et User-Agent pour le tracking
    const ipAddress = request.headers.get("x-forwarded-for")?.split(',')[0] || 
                     request.headers.get("x-real-ip") || 
                     request.ip || 
                     "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";
    
    console.log("Client IP:", ipAddress, "User-Agent:", userAgent);

    // Normaliser l'email pour détecter les variations (test+1@gmail.com = test@gmail.com)
    const normalizedEmail = user.email?.toLowerCase().replace(/\+.*@/, '@') || '';
    
    // CONTRÔLE 1: Vérifier s'il existe déjà un abonnement d'essai pour cet utilisateur
    const existingTrialSubscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        isTrial: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existingTrialSubscription) {
      console.log("User has already used trial - existing trial subscription found:", existingTrialSubscription.id);
      return NextResponse.json(
        { 
          success: false, 
          message: "Vous avez déjà utilisé votre essai gratuit" 
        },
        { status: 400 }
      );
    }

    // CONTRÔLE 2: Vérifier les autres utilisateurs avec des emails similaires qui ont des essais
    const emailVariations = [user.email?.toLowerCase(), normalizedEmail].filter(Boolean);
    const similarEmailTrials = await prisma.subscription.findFirst({
      where: {
        isTrial: true,
        user: {
          email: {
            in: emailVariations as string[]
          },
          id: {
            not: user.id // Exclure l'utilisateur actuel
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (similarEmailTrials) {
      console.log("Trial found for similar email:", user.email);
      return NextResponse.json(
        { 
          success: false, 
          message: "Un essai gratuit a déjà été utilisé avec cette adresse email" 
        },
        { status: 400 }
      );
    }

    // Note: IP-based validation removed as IP tracking is not available in current schema


    // Vérifier s'il a déjà un abonnement actif
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        expiresAt: { gte: new Date() },
        OR: [
          { paymentId: null }, // Essai gratuit
          { 
            payment: { 
              status: { in: ["succeeded", "processing"] } 
            } 
          }
        ]
      },
    });

    if (activeSubscription) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Vous avez déjà un abonnement actif" 
        },
        { status: 400 }
      );
    }

    // Récupérer le plan et vérifier qu'il supporte l'essai
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, message: "Plan non trouvé" },
        { status: 404 }
      );
    }

    if (!plan.isTrialEligible || !plan.trialDurationDays) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Ce plan ne propose pas d'essai gratuit" 
        },
        { status: 400 }
      );
    }

    // Calculer les dates d'essai
    const trialStartDate = new Date();
    const trialEndDate = moment(trialStartDate)
      .add(plan.trialDurationDays, 'days')
      .toDate();

    // Générer une référence unique pour l'abonnement d'essai
    const reference = `TRIAL-${user.id.slice(-8)}-${Date.now()}`;

    // Créer l'abonnement d'essai et l'historique dans une transaction
    const trialSubscription = await prisma.$transaction(async (tx) => {
      // Créer l'abonnement d'essai
      const subscription = await tx.subscription.create({
        data: {
          reference,
          planId: plan.id,
          userId: user.id,
          period: "week", // Always use week for trial period
          isTrial: true,
          trialStarted: trialStartDate,
          trialEnd: trialEndDate,
          trialPrice: 0.00, // Free trial
          expiresAt: trialEndDate,
          paymentId: null, // Pas de paiement pour l'essai
        },
        include: {
          plan: true,
          user: true,
        },
      });

      return subscription;
    });

    // Note: User trial tracking is handled via the subscription record with isTrial: true

    // Envoyer l'email de confirmation d'essai
    try {
      console.log("Sending trial confirmation email to:", user.email);
      if (user.email) {
        const emailContent = await buildTrialStartedEmail(trialSubscription);
        await sendEmail({
          to: user.email,
          subject: emailContent.emailSubject,
          html: emailContent.emailHtml,
          text: emailContent.emailText,
        });
        console.log("Trial confirmation email sent successfully");
      }
    } catch (emailError) {
      console.error("Erreur envoi email d'essai:", emailError);
      // Ne pas faire échouer la création de l'essai pour un problème d'email
    }

    // Log de sécurité
    console.log(`TRIAL_STARTED: User ${user.id} (${user.email}) started trial ${trialSubscription.id} from IP ${ipAddress} at ${new Date().toISOString()}`);
    
    // Log de l'action pour audit
    console.log(`AUDIT: Trial created with strict validation - UserID: ${user.id}, Email: ${user.email}, IP: ${ipAddress}, SubscriptionID: ${trialSubscription.id}`);

    return NextResponse.json({
      success: true,
      message: "Essai gratuit activé avec succès",
      trial: {
        id: trialSubscription.id,
        reference: trialSubscription.reference,
        planTitle: plan.title,
        period: trialSubscription.period,
        price: trialSubscription.trialPrice?.toString() || "0.00",
        currency: plan.amountCurrency,
        trialStart: trialSubscription.trialStarted,
        trialEnd: trialSubscription.trialEnd,
        daysRemaining: plan.trialDurationDays,
      },
      redirectUrl: "/member/dashboard",
    });

  } catch (error) {
    console.error("Erreur lors de la création de l'essai:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "Erreur interne du serveur" 
      },
      { status: 500 }
    );
  }
}