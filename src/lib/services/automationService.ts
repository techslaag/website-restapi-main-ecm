import prisma from "@/lib/prisma";
import moment from "moment";
import { EmailTemplate } from "@prisma/client";

/**
 * Service pour gérer les automations email
 */
class AutomationService {
  
  /**
   * Démarre automatiquement la série de bienvenue pour un nouvel utilisateur
   */
  async triggerWelcomeSeriesForNewUser(userId: string): Promise<void> {
    try {
      console.log(`🎯 Triggering welcome series for new user: ${userId}`);

      // Vérifier si l'automation "Série de bienvenue" est active via SQL
      const welcomeAutomation = await prisma.$queryRaw`
        SELECT id FROM Automation 
        WHERE type = 'welcome_series' AND active = true 
        LIMIT 1
      `;

      if ((welcomeAutomation as any[]).length === 0) {
        console.log('⚠️ Welcome series automation is not active, skipping...');
        return;
      }

      const automationId = (welcomeAutomation as any)[0].id;

      // Vérifier si l'utilisateur n'a pas déjà reçu la série de bienvenue
      const existingJobs = await prisma.$queryRaw`
        SELECT id FROM EmailJob 
        WHERE userId = ${userId} AND templateType = 'welcome'
        LIMIT 1
      `;

      if ((existingJobs as any[]).length > 0) {
        console.log(`⚠️ User ${userId} already has welcome series, skipping...`);
        return;
      }

      // Récupérer les informations de l'utilisateur
      const userResult = await prisma.$queryRaw`
        SELECT email, name FROM User WHERE id = ${userId} LIMIT 1
      `;

      if ((userResult as any[]).length === 0) {
        console.error(`❌ User ${userId} not found`);
        return;
      }

      const user = (userResult as any)[0];
      const now = new Date();

      // Créer les IDs pour les jobs
      const welcomeJobId = `cm${Date.now()}w${Math.random().toString(36).substr(2, 7)}`;
      const discoveryJobId = `cm${Date.now()}d${Math.random().toString(36).substr(2, 7)}`;
      const specialOfferJobId = `cm${Date.now()}s${Math.random().toString(36).substr(2, 7)}`;

      // Créer les jobs via SQL
      // Email 1: Welcome - immédiat
      await prisma.$executeRaw`
        INSERT INTO EmailJob (id, automationId, userId, templateType, status, scheduledFor, createdAt, updatedAt)
        VALUES (${welcomeJobId}, ${automationId}, ${userId}, 'welcome', 'pending', NOW(), NOW(), NOW())
      `;

      // Email 2: Discovery - J+3
      const discoveryDate = moment(now).add(3, 'days').toDate();
      await prisma.$executeRaw`
        INSERT INTO EmailJob (id, automationId, userId, templateType, status, scheduledFor, createdAt, updatedAt)
        VALUES (${discoveryJobId}, ${automationId}, ${userId}, 'discovery', 'pending', ${discoveryDate}, NOW(), NOW())
      `;

      // Email 3: Special offer - J+7
      const specialOfferDate = moment(now).add(7, 'days').toDate();
      await prisma.$executeRaw`
        INSERT INTO EmailJob (id, automationId, userId, templateType, status, scheduledFor, createdAt, updatedAt)
        VALUES (${specialOfferJobId}, ${automationId}, ${userId}, 'special_offer', 'pending', ${specialOfferDate}, NOW(), NOW())
      `;

      console.log(`✅ Welcome series scheduled for user ${userId} (${user.email})`);
      console.log(`📧 3 emails scheduled: welcome (now), discovery (J+3), special_offer (J+7)`);

    } catch (error) {
      console.error(`❌ Failed to trigger welcome series for user ${userId}:`, error);
      // Ne pas faire échouer la création d'utilisateur si l'automation échoue
    }
  }

  /**
   * Démarre automatiquement l'automation de renouvellement pour un utilisateur
   */
  async triggerRenewalAutomationForUser(userId: string, subscriptionExpiryDate: Date): Promise<void> {
    try {
      console.log(`🔄 Triggering renewal automation for user: ${userId}`);

      // Vérifier si l'automation de renouvellement est active
      const renewalAutomation = await prisma.automation.findFirst({
        where: {
          type: 'subscription_renewal',
          active: true
        }
      });

      if (!renewalAutomation) {
        console.log('⚠️ Renewal automation is not active, skipping...');
        return;
      }

      const expiryDate = moment(subscriptionExpiryDate);

      // Créer les jobs pour les rappels de renouvellement
      const emailJobs = [
        {
          userId: userId,
          automationId: renewalAutomation.id,
          templateType: EmailTemplate.renewal_reminder_7d,
          scheduledFor: expiryDate.clone().subtract(7, 'days').toDate(),
          status: 'pending' as const
        },
        {
          userId: userId,
          automationId: renewalAutomation.id,
          templateType: EmailTemplate.renewal_reminder_3d,
          scheduledFor: expiryDate.clone().subtract(3, 'days').toDate(),
          status: 'pending' as const
        },
        {
          userId: userId,
          automationId: renewalAutomation.id,
          templateType: EmailTemplate.renewal_reminder_1d,
          scheduledFor: expiryDate.clone().subtract(1, 'day').toDate(),
          status: 'pending' as const
        }
      ];

      // Supprimer les anciens jobs de renouvellement pour cet utilisateur
      await prisma.emailJob.deleteMany({
        where: {
          userId: userId,
          templateType: {
            in: [EmailTemplate.renewal_reminder_7d, EmailTemplate.renewal_reminder_3d, EmailTemplate.renewal_reminder_1d]
          },
          status: 'pending'
        }
      });

      // Créer les nouveaux jobs
      await prisma.emailJob.createMany({
        data: emailJobs
      });

      console.log(`✅ Renewal automation scheduled for user ${userId}`);
      console.log(`📧 3 renewal reminders scheduled before ${expiryDate.format('YYYY-MM-DD')}`);

    } catch (error) {
      console.error(`❌ Failed to trigger renewal automation for user ${userId}:`, error);
    }
  }

  /**
   * Démarre automatiquement l'automation de récupération pour un utilisateur avec abonnement expiré
   */
  async triggerWinbackAutomationForUser(userId: string): Promise<void> {
    try {
      console.log(`💔 Triggering winback automation for user: ${userId}`);

      // Vérifier si l'automation de récupération est active
      const winbackAutomation = await prisma.automation.findFirst({
        where: {
          type: 'subscription_winback',
          active: true
        }
      });

      if (!winbackAutomation) {
        console.log('⚠️ Winback automation is not active, skipping...');
        return;
      }

      // Vérifier si l'utilisateur n'a pas déjà reçu la série de récupération récemment
      const recentWinbackJob = await prisma.emailJob.findFirst({
        where: {
          userId: userId,
          templateType: EmailTemplate.winback_miss_you,
          createdAt: {
            gte: moment().subtract(30, 'days').toDate()
          }
        }
      });

      if (recentWinbackJob) {
        console.log(`⚠️ User ${userId} already received winback series recently, skipping...`);
        return;
      }

      const now = new Date();

      // Créer les jobs pour la série de récupération
      const emailJobs = [
        {
          userId: userId,
          automationId: winbackAutomation.id,
          templateType: EmailTemplate.winback_miss_you,
          scheduledFor: moment(now).add(1, 'day').toDate(), // J+1 après expiration
          status: 'pending' as const
        },
        {
          userId: userId,
          automationId: winbackAutomation.id,
          templateType: EmailTemplate.winback_special_offer,
          scheduledFor: moment(now).add(7, 'days').toDate(), // J+7
          status: 'pending' as const
        },
        {
          userId: userId,
          automationId: winbackAutomation.id,
          templateType: EmailTemplate.winback_last_chance,
          scheduledFor: moment(now).add(14, 'days').toDate(), // J+14
          status: 'pending' as const
        }
      ];

      // Créer tous les jobs
      await prisma.emailJob.createMany({
        data: emailJobs
      });

      console.log(`✅ Winback automation scheduled for user ${userId}`);
      console.log(`📧 3 winback emails scheduled over 14 days`);

    } catch (error) {
      console.error(`❌ Failed to trigger winback automation for user ${userId}:`, error);
    }
  }
}

export const automationService = new AutomationService();
export default automationService;