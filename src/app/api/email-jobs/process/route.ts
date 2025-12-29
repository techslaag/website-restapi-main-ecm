import { NextRequest } from 'next/server';
import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils";
import mailchimpService from "@/lib/services/mailchimpService";

export const dynamic = "force-dynamic";

// Fonction pour envoyer un email via Mailchimp
async function sendEmail(user: any, templateType: string) {
  console.log(`📧 Sending ${templateType} email to ${user.email} via Mailchimp`);
  
  // Récupérer le template depuis le service Mailchimp
  const template = mailchimpService.getTemplate(templateType);
  
  if (!template) {
    throw new Error(`Template ${templateType} not found`);
  }

  // Personnaliser le template avec les données utilisateur
  const personalizedTemplate = {
    subject: template.subject,
    htmlContent: template.htmlContent.replace(/\*\|FNAME\|\*/g, user.name || 'cher utilisateur'),
    textContent: template.textContent?.replace(/\*\|FNAME\|\*/g, user.name || 'cher utilisateur')
  };

  try {
    // Envoyer l'email via Mailchimp
    const result = await mailchimpService.sendEmail({
      to: user.email,
      name: user.name || '',
      template: personalizedTemplate,
      // Optionnel: spécifier une liste Mailchimp spécifique pour les automations
      // listId: process.env.MAILCHIMP_AUTOMATION_LIST_ID
    });

    if (!result.success) {
      throw new Error(result.error || 'Mailchimp send failed');
    }

    console.log(`✅ Email ${templateType} sent successfully to ${user.email}`);
    console.log(`📧 Message ID: ${result.messageId}`);
    
    return {
      success: true,
      subject: personalizedTemplate.subject,
      messageId: result.messageId,
      campaignId: result.campaignId,
      provider: 'mailchimp'
    };

  } catch (error) {
    console.error(`❌ Failed to send ${templateType} email to ${user.email}:`, error);
    throw error;
  }
}

// GET /api/email-jobs/process - Traiter les emails en attente
export async function GET(req: NextRequest) {
  try {
    console.log('🔄 Starting email job processing...');
    const now = new Date();
    
    // Récupérer les jobs d'email à traiter via SQL
    const pendingJobs = await prisma.$queryRaw`
      SELECT 
        ej.id,
        ej.userId,
        ej.automationId,
        ej.templateType,
        ej.status,
        ej.scheduledFor,
        u.email as userEmail,
        u.name as userName,
        a.name as automationName,
        a.type as automationType
      FROM EmailJob ej
      LEFT JOIN User u ON ej.userId = u.id
      LEFT JOIN Automation a ON ej.automationId = a.id
      WHERE ej.status = 'pending' 
      AND ej.scheduledFor <= NOW()
      ORDER BY ej.scheduledFor ASC
      LIMIT 50
    `;

    console.log(`📨 Processing ${(pendingJobs as any[]).length} pending email jobs`);

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Traiter chaque job
    for (const job of (pendingJobs as any[])) {
      try {
        // Marquer comme en cours de traitement via SQL
        await prisma.$executeRaw`
          UPDATE EmailJob 
          SET status = 'processing', updatedAt = NOW()
          WHERE id = ${job.id}
        `;

        // Préparer les données utilisateur pour la fonction sendEmail
        const userData = {
          email: job.userEmail,
          name: job.userName
        };

        // Envoyer l'email
        const emailResult = await sendEmail(userData, job.templateType);

        // Marquer comme envoyé via SQL
        await prisma.$executeRaw`
          UPDATE EmailJob 
          SET status = 'sent', sentAt = NOW(), emailData = ${JSON.stringify(emailResult)}, updatedAt = NOW()
          WHERE id = ${job.id}
        `;

        // Logger l'envoi via SQL
        const logId = `cm${Date.now()}l${Math.random().toString(36).substr(2, 7)}`;
        await prisma.$executeRaw`
          INSERT INTO EmailLog (id, userId, templateType, subject, status, sentAt)
          VALUES (${logId}, ${job.userId}, ${job.templateType}, ${emailResult.subject}, 'sent', NOW())
        `;

        results.sent++;
        console.log(`✅ Email ${job.templateType} sent to ${job.userEmail}`);

      } catch (error) {
        // Marquer comme échec via SQL
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        await prisma.$executeRaw`
          UPDATE EmailJob 
          SET status = 'failed', error = ${errorMessage}, updatedAt = NOW()
          WHERE id = ${job.id}
        `;

        // Logger l'échec via SQL
        const logId = `cm${Date.now()}f${Math.random().toString(36).substr(2, 7)}`;
        await prisma.$executeRaw`
          INSERT INTO EmailLog (id, userId, templateType, subject, status, sentAt, errorMessage)
          VALUES (${logId}, ${job.userId}, ${job.templateType}, ${'Failed: ' + job.templateType}, 'failed', NOW(), ${errorMessage})
        `;

        results.failed++;
        results.errors.push(`Failed to send ${job.templateType} to ${job.userEmail}: ${errorMessage}`);
        console.error(`❌ Failed to send email to ${job.userEmail}:`, error);
      }

      results.processed++;
    }

    return Response.json(toSafeJSON({
      results,
      message: `Processed ${results.processed} email jobs: ${results.sent} sent, ${results.failed} failed`
    }));

  } catch (error) {
    console.error('Error processing email jobs:', error);
    return Response.json(
      { error: 'Failed to process email jobs' },
      { status: 500 }
    );
  }
}

// POST /api/email-jobs/process - Traitement manuel (pour les tests)
export async function POST(req: NextRequest) {
  return GET(req);
}