import { NextRequest } from 'next/server';
import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { active, targetUserIds } = body;

    console.log('🎯 Activating welcome series automation...');
    console.log('Active:', active, 'Target users:', targetUserIds?.length || 0);

    // 1. Créer ou mettre à jour l'automation welcome-series via SQL
    const existingAutomation = await prisma.$queryRaw`
      SELECT id FROM Automation WHERE type = 'welcome_series' LIMIT 1
    `;

    let automationId;
    
    if ((existingAutomation as any[]).length > 0) {
      // Mettre à jour l'automation existante
      automationId = (existingAutomation as any)[0].id;
      await prisma.$executeRaw`
        UPDATE Automation 
        SET active = ${active}, updatedAt = NOW() 
        WHERE id = ${automationId}
      `;
      console.log(`✅ Updated existing automation: ${automationId}`);
    } else {
      // Créer une nouvelle automation
      const newId = `cm${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
      automationId = newId;
      
      await prisma.$executeRaw`
        INSERT INTO Automation (id, name, type, active, settings, createdAt, updatedAt)
        VALUES (
          ${automationId},
          'Série de bienvenue',
          'welcome_series',
          ${active},
          ${JSON.stringify({
            emailSequence: [
              { template: 'welcome', delayDays: 0 },
              { template: 'discovery', delayDays: 3 },
              { template: 'special_offer', delayDays: 7 }
            ]
          })},
          NOW(),
          NOW()
        )
      `;
      console.log(`✅ Created new automation: ${automationId}`);
    }

    let jobsCreated = 0;

    if (active && targetUserIds && targetUserIds.length > 0) {
      // 2. Créer les jobs d'email pour les utilisateurs ciblés via SQL
      const now = new Date();

      for (const userId of targetUserIds) {
        // Vérifier si l'utilisateur n'a pas déjà des jobs en cours
        const existingJobs = await prisma.$queryRaw`
          SELECT id FROM EmailJob 
          WHERE automationId = ${automationId} 
          AND userId = ${userId} 
          AND status IN ('pending', 'processing')
          LIMIT 1
        `;

        if ((existingJobs as any[]).length === 0) {
          // Créer les IDs pour les jobs
          const welcomeJobId = `cm${Date.now()}w${Math.random().toString(36).substr(2, 7)}`;
          const discoveryJobId = `cm${Date.now()}d${Math.random().toString(36).substr(2, 7)}`;
          const specialOfferJobId = `cm${Date.now()}s${Math.random().toString(36).substr(2, 7)}`;

          // Email 1: Welcome - immédiat
          await prisma.$executeRaw`
            INSERT INTO EmailJob (id, automationId, userId, templateType, status, scheduledFor, createdAt, updatedAt)
            VALUES (${welcomeJobId}, ${automationId}, ${userId}, 'welcome', 'pending', NOW(), NOW(), NOW())
          `;

          // Email 2: Discovery - J+3
          const discoveryDate = new Date(now);
          discoveryDate.setDate(discoveryDate.getDate() + 3);
          await prisma.$executeRaw`
            INSERT INTO EmailJob (id, automationId, userId, templateType, status, scheduledFor, createdAt, updatedAt)
            VALUES (${discoveryJobId}, ${automationId}, ${userId}, 'discovery', 'pending', ${discoveryDate}, NOW(), NOW())
          `;

          // Email 3: Special offer - J+7
          const specialOfferDate = new Date(now);
          specialOfferDate.setDate(specialOfferDate.getDate() + 7);
          await prisma.$executeRaw`
            INSERT INTO EmailJob (id, automationId, userId, templateType, status, scheduledFor, createdAt, updatedAt)
            VALUES (${specialOfferJobId}, ${automationId}, ${userId}, 'special_offer', 'pending', ${specialOfferDate}, NOW(), NOW())
          `;

          jobsCreated += 3;
          console.log(`✅ Created 3 email jobs for user ${userId}`);
        } else {
          console.log(`⚠️ User ${userId} already has pending jobs, skipping`);
        }
      }
    }

    // 3. Si on désactive, annuler les jobs en attente
    if (!active) {
      await prisma.$executeRaw`
        UPDATE EmailJob 
        SET status = 'cancelled', updatedAt = NOW()
        WHERE automationId = ${automationId} AND status = 'pending'
      `;
      console.log('🚫 Cancelled pending jobs for welcome series');
    }

    // Récupérer l'automation pour la réponse
    const automationData = await prisma.$queryRaw`
      SELECT * FROM Automation WHERE id = ${automationId} LIMIT 1
    `;

    return Response.json(toSafeJSON({
      automation: (automationData as any[])[0],
      jobsCreated,
      message: active 
        ? `Welcome series activated with ${jobsCreated} email jobs created`
        : 'Welcome series deactivated, pending jobs cancelled'
    }));

  } catch (error) {
    console.error('Error activating welcome series:', error);
    return Response.json(
      { error: 'Failed to activate welcome series' },
      { status: 500 }
    );
  }
}