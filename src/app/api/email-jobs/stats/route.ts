import { NextRequest } from 'next/server';
import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/email-jobs/stats - Obtenir les statistiques des jobs d'email
export async function GET(req: NextRequest) {
  try {
    console.log('📊 Fetching email job stats using SQL...');

    // Utilisation de SQL brut pour contourner le problème de client Prisma
    const totalJobsResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM EmailJob`;
    const totalJobs = Number((totalJobsResult as any)[0]?.count || 0);
    console.log(`Total jobs found: ${totalJobs}`);

    const totalAutomationsResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM Automation`;
    const totalAutomations = Number((totalAutomationsResult as any)[0]?.count || 0);
    console.log(`Total automations found: ${totalAutomations}`);

    if (totalJobs === 0) {
      return Response.json(toSafeJSON({
        summary: {
          total: 0,
          pendingNow: 0,
          scheduledLater: 0,
          automations: totalAutomations
        },
        recentJobs: [],
        message: 'No email jobs found - system ready for new automations'
      }));
    }

    // Jobs en attente maintenant
    const pendingJobsResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM EmailJob 
      WHERE status = 'pending' AND scheduledFor <= NOW()
    `;
    const pendingJobs = Number((pendingJobsResult as any)[0]?.count || 0);

    // Jobs programmés pour plus tard
    const scheduledJobsResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM EmailJob 
      WHERE status = 'pending' AND scheduledFor > NOW()
    `;
    const scheduledJobs = Number((scheduledJobsResult as any)[0]?.count || 0);

    // Jobs récents
    const recentJobsResult = await prisma.$queryRaw`
      SELECT 
        ej.id,
        ej.templateType,
        ej.status,
        ej.scheduledFor,
        ej.sentAt,
        ej.createdAt,
        ej.error,
        u.email as userEmail,
        u.name as userName
      FROM EmailJob ej
      LEFT JOIN User u ON ej.userId = u.id
      ORDER BY ej.createdAt DESC
      LIMIT 10
    `;

    return Response.json(toSafeJSON({
      summary: {
        total: totalJobs,
        pendingNow: pendingJobs,
        scheduledLater: scheduledJobs,
        automations: totalAutomations
      },
      recentJobs: (recentJobsResult as any[]).map((job: any) => ({
        id: job.id,
        templateType: job.templateType,
        status: job.status,
        userEmail: job.userEmail,
        userName: job.userName,
        scheduledFor: job.scheduledFor,
        sentAt: job.sentAt,
        createdAt: job.createdAt,
        error: job.error
      })),
      message: `Found ${totalJobs} email jobs and ${totalAutomations} automations`
    }));

  } catch (error) {
    console.error('❌ Error fetching email job stats:', error);
    return Response.json(
      { 
        error: 'Failed to fetch email job stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}