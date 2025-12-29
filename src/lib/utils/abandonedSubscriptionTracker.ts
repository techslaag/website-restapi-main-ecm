import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { AbandonedSubscriptionStep, AbandonedSubscriptionStatus } from '@prisma/client';

interface TrackAbandonedSubscriptionParams {
  sessionId?: string;
  userId?: string;
  planId: string;
  period: 'month' | 'year' | 'week';
  email?: string;
  step: AbandonedSubscriptionStep;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  metadata?: any;
}

interface TrackActivityParams {
  abandonedSubscriptionId: string;
  step: AbandonedSubscriptionStep;
  action: string;
  metadata?: any;
}

/**
 * Extrait les informations de tracking depuis une requête HTTP Next.js
 */
export function extractTrackingInfo(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || undefined;
  const ipAddress = 
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.ip ||
    'unknown';
  const referrer = request.headers.get('referer') || request.headers.get('referrer') || undefined;
  
  // Extraire les paramètres UTM depuis l'URL
  const url = new URL(request.url);
  const utmSource = url.searchParams.get('utm_source') || undefined;
  const utmMedium = url.searchParams.get('utm_medium') || undefined;
  const utmCampaign = url.searchParams.get('utm_campaign') || undefined;

  return {
    userAgent,
    ipAddress,
    referrer,
    utmSource,
    utmMedium,
    utmCampaign
  };
}

/**
 * Génère ou récupère un ID de session pour le tracking
 */
export function generateSessionId(request: NextRequest): string {
  // Tentative de récupération depuis les cookies ou headers
  const existingSessionId = 
    request.cookies.get('session_id')?.value || 
    request.headers.get('x-session-id');
  
  if (existingSessionId) {
    return existingSessionId;
  }

  // Générer un nouvel ID de session
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2)}`;
}

/**
 * Crée ou met à jour un enregistrement d'abonnement abandonné
 */
export async function trackAbandonedSubscription(params: TrackAbandonedSubscriptionParams) {
  try {
    // Vérifier s'il existe déjà un enregistrement pour cette session/utilisateur + plan
    const existing = await prisma.abandonedSubscription.findFirst({
      where: {
        OR: [
          {
            sessionId: params.sessionId,
            planId: params.planId,
            status: 'abandoned'
          },
          {
            userId: params.userId,
            planId: params.planId,
            status: 'abandoned'
          }
        ]
      }
    });

    if (existing) {
      // Mettre à jour l'enregistrement existant
      const updated = await prisma.abandonedSubscription.update({
        where: { id: existing.id },
        data: {
          step: params.step,
          email: params.email || existing.email,
          userId: params.userId || existing.userId,
          lastActivityAt: new Date(),
          userAgent: params.userAgent || existing.userAgent,
          ipAddress: params.ipAddress || existing.ipAddress,
          referrer: params.referrer || existing.referrer,
          utmSource: params.utmSource || existing.utmSource,
          utmMedium: params.utmMedium || existing.utmMedium,
          utmCampaign: params.utmCampaign || existing.utmCampaign,
          metadata: params.metadata ? {
            ...((existing.metadata as any) || {}),
            ...params.metadata
          } : existing.metadata,
          updatedAt: new Date()
        }
      });

      // Enregistrer l'activité
      await trackActivity({
        abandonedSubscriptionId: updated.id,
        step: params.step,
        action: 'step_updated',
        metadata: params.metadata
      });

      return updated;
    } else {
      // Créer un nouvel enregistrement
      const abandoned = await prisma.abandonedSubscription.create({
        data: {
          sessionId: params.sessionId,
          userId: params.userId,
          planId: params.planId,
          period: params.period,
          email: params.email,
          step: params.step,
          status: 'abandoned',
          userAgent: params.userAgent,
          ipAddress: params.ipAddress,
          referrer: params.referrer,
          utmSource: params.utmSource,
          utmMedium: params.utmMedium,
          utmCampaign: params.utmCampaign,
          metadata: params.metadata,
          abandonedAt: new Date(),
          lastActivityAt: new Date(),
          createdAt: new Date()
        }
      });

      // Enregistrer l'activité initiale
      await trackActivity({
        abandonedSubscriptionId: abandoned.id,
        step: params.step,
        action: 'abandoned_subscription_created',
        metadata: params.metadata
      });

      return abandoned;
    }
  } catch (error) {
    console.error('Error tracking abandoned subscription:', error);
    throw error;
  }
}

/**
 * Enregistre une activité pour un abonnement abandonné
 */
export async function trackActivity(params: TrackActivityParams) {
  try {
    return await prisma.abandonedSubscriptionActivity.create({
      data: {
        abandonedSubscriptionId: params.abandonedSubscriptionId,
        step: params.step,
        action: params.action,
        metadata: params.metadata,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error tracking abandoned subscription activity:', error);
    throw error;
  }
}

/**
 * Marque un abonnement abandonné comme récupéré
 */
export async function markAsRecovered(
  sessionId: string | null,
  userId: string | null,
  planId: string,
  completedSubscriptionId: string
) {
  try {
    // Trouver l'abonnement abandonné correspondant
    const abandoned = await prisma.abandonedSubscription.findFirst({
      where: {
        OR: [
          { sessionId, planId, status: 'abandoned' },
          { userId, planId, status: 'abandoned' }
        ]
      }
    });

    if (abandoned) {
      // Marquer comme récupéré
      const updated = await prisma.abandonedSubscription.update({
        where: { id: abandoned.id },
        data: {
          status: 'recovered',
          recoveredAt: new Date(),
          completedSubscriptionId,
          updatedAt: new Date()
        }
      });

      // Enregistrer l'activité de récupération
      await trackActivity({
        abandonedSubscriptionId: abandoned.id,
        step: abandoned.step,
        action: 'subscription_completed',
        metadata: { completedSubscriptionId }
      });

      return updated;
    }

    return null;
  } catch (error) {
    console.error('Error marking abandoned subscription as recovered:', error);
    throw error;
  }
}

/**
 * Marque les abonnements abandonnés comme expirés (à exécuter périodiquement)
 */
export async function markExpiredAbandoned(daysOld: number = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const updated = await prisma.abandonedSubscription.updateMany({
      where: {
        status: 'abandoned',
        abandonedAt: {
          lt: cutoffDate
        }
      },
      data: {
        status: 'expired',
        updatedAt: new Date()
      }
    });

    return updated;
  } catch (error) {
    console.error('Error marking expired abandoned subscriptions:', error);
    throw error;
  }
}

/**
 * Récupère les statistiques des abonnements abandonnés
 */
export async function getAbandonedSubscriptionStats(days: number = 30) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      totalAbandoned,
      recovered,
      byStep,
      byPlan,
      recentActivity
    ] = await Promise.all([
      // Total des abandons
      prisma.abandonedSubscription.count({
        where: {
          abandonedAt: { gte: since }
        }
      }),

      // Récupérés
      prisma.abandonedSubscription.count({
        where: {
          status: 'recovered',
          recoveredAt: { gte: since }
        }
      }),

      // Par étape d'abandon
      prisma.abandonedSubscription.groupBy({
        by: ['step'],
        where: {
          abandonedAt: { gte: since }
        },
        _count: true
      }),

      // Par plan
      prisma.abandonedSubscription.groupBy({
        by: ['planId'],
        where: {
          abandonedAt: { gte: since }
        },
        _count: true
      }),

      // Activité récente
      prisma.abandonedSubscription.findMany({
        where: {
          lastActivityAt: { gte: since }
        },
        include: {
          plan: { select: { title: true } },
          user: { select: { name: true, email: true } },
          activities: {
            orderBy: { timestamp: 'desc' },
            take: 5
          }
        },
        orderBy: { lastActivityAt: 'desc' },
        take: 20
      })
    ]);

    const recoveryRate = totalAbandoned > 0 ? (recovered / totalAbandoned) * 100 : 0;

    return {
      totalAbandoned,
      recovered,
      recoveryRate: Math.round(recoveryRate * 100) / 100,
      byStep,
      byPlan,
      recentActivity
    };
  } catch (error) {
    console.error('Error getting abandoned subscription stats:', error);
    throw error;
  }
}