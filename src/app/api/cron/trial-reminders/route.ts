import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/mail";
import { buildTrialExpiringEmail } from "@/lib/mail/emails/buildTrialExpiringEmail";
import { NextRequest, NextResponse } from "next/server";
import moment from "moment";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 30 minutes (1800 seconds)

/**
 * GET /api/cron/trial-reminders
 * Envoie des rappels automatiques pour les essais qui expirent bientôt
 * 
 * À exécuter avec un CRON job quotidien :
 * - 3 jours avant expiration
 * - 1 jour avant expiration  
 * - Le jour d'expiration
 */
export async function GET(request: NextRequest) {
  try {
    // Vérification de sécurité pour les CRON jobs
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, message: "Non autorisé" },
        { status: 401 }
      );
    }

    const now = moment();
    const in3Days = moment().add(3, 'days');
    const in1Day = moment().add(1, 'day');
    const today = moment().endOf('day');

    // Essais expirant dans 3 jours (première alerte)
    const trialsExpiring3Days = await prisma.subscription.findMany({
      where: {
        isTrial: true,
        trialEnd: {
          gte: in3Days.startOf('day').toDate(),
          lte: in3Days.endOf('day').toDate(),
        },
        trialConvertedAt: null, // Pas encore convertis
      },
      include: {
        plan: true,
        user: true,
      },
    });

    // Essais expirant dans 1 jour (deuxième alerte)
    const trialsExpiring1Day = await prisma.subscription.findMany({
      where: {
        isTrial: true,
        trialEnd: {
          gte: in1Day.startOf('day').toDate(),
          lte: in1Day.endOf('day').toDate(),
        },
        trialConvertedAt: null,
      },
      include: {
        plan: true,
        user: true,
      },
    });

    // Essais expirant aujourd'hui (alerte finale)
    const trialsExpiringToday = await prisma.subscription.findMany({
      where: {
        isTrial: true,
        trialEnd: {
          gte: now.startOf('day').toDate(),
          lte: today.toDate(),
        },
        trialConvertedAt: null,
      },
      include: {
        plan: true,
        user: true,
      },
    });

    const results = {
      sent3DayReminders: 0,
      sent1DayReminders: 0,
      sentFinalReminders: 0,
      errors: [] as string[],
    };

    // Envoyer les rappels 3 jours
    for (const subscription of trialsExpiring3Days) {
      try {
        if (!subscription.user.email) {
          console.warn(`Pas d'email pour l'utilisateur ${subscription.user.id}`);
          continue;
        }
        
        const emailData = await buildTrialExpiringEmail(subscription);
        
        await sendEmail({
          to: subscription.user.email,
          subject: emailData.emailSubject,
          html: emailData.emailHtml,
          text: emailData.emailText,
        });

        // TODO: Add reminder tracking fields to User model if needed

        results.sent3DayReminders++;
      } catch (error) {
        console.error(`Erreur envoi rappel 3j pour ${subscription.user.email}:`, error);
        results.errors.push(`3j - ${subscription.user.email}: ${error}`);
      }
    }

    // Envoyer les rappels 1 jour
    for (const subscription of trialsExpiring1Day) {
      try {
        if (!subscription.user.email) {
          console.warn(`Pas d'email pour l'utilisateur ${subscription.user.id}`);
          continue;
        }
        
        const emailData = await buildTrialExpiringEmail(subscription);
        
        await sendEmail({
          to: subscription.user.email,
          subject: emailData.emailSubject,
          html: emailData.emailHtml,
          text: emailData.emailText,
        });

        // TODO: Add reminder tracking fields to User model if needed

        results.sent1DayReminders++;
      } catch (error) {
        console.error(`Erreur envoi rappel 1j pour ${subscription.user.email}:`, error);
        results.errors.push(`1j - ${subscription.user.email}: ${error}`);
      }
    }

    // Envoyer les rappels finaux
    for (const subscription of trialsExpiringToday) {
      try {
        if (!subscription.user.email) {
          console.warn(`Pas d'email pour l'utilisateur ${subscription.user.id}`);
          continue;
        }
        
        const emailData = await buildTrialExpiringEmail(subscription);
        
        await sendEmail({
          to: subscription.user.email,
          subject: emailData.emailSubject,
          html: emailData.emailHtml,
          text: emailData.emailText,
        });

        // TODO: Add reminder tracking fields to User model if needed

        results.sentFinalReminders++;
      } catch (error) {
        console.error(`Erreur envoi rappel final pour ${subscription.user.email}:`, error);
        results.errors.push(`final - ${subscription.user.email}: ${error}`);
      }
    }

    console.log(`CRON trial reminders - 3j: ${results.sent3DayReminders}, 1j: ${results.sent1DayReminders}, final: ${results.sentFinalReminders}, erreurs: ${results.errors.length}`);

    return NextResponse.json({
      success: true,
      message: "Rappels d'essai envoyés avec succès",
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Erreur CRON trial reminders:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "Erreur interne du serveur",
        error: error instanceof Error ? error.message : "Erreur inconnue"
      },
      { status: 500 }
    );
  }
}