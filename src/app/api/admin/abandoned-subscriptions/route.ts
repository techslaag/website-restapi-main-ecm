import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import authMiddleware from '@/lib/auth/authMiddleware';
import { getAbandonedSubscriptionStats } from '@/lib/utils/abandonedSubscriptionTracker';
import { serializeError } from 'serialize-error';

/**
 * @swagger
 * /admin/abandoned-subscriptions:
 *   get:
 *     summary: Récupérer les abonnements abandonnés
 *     description: Obtient la liste des abonnements abandonnés avec pagination et filtres
 *     tags:
 *       - Admin
 *       - Abandoned Subscriptions
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Numéro de page (défaut 1)
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         description: Nombre d'éléments par page (défaut 20)
 *         schema:
 *           type: integer
 *           default: 20
 *       - name: status
 *         in: query
 *         description: Filtrer par statut
 *         schema:
 *           type: string
 *           enum: [abandoned, recovered, expired]
 *       - name: step
 *         in: query
 *         description: Filtrer par étape d'abandon
 *         schema:
 *           type: string
 *           enum: [plan_selection, user_registration, payment_method, payment_processing, payment_failed, email_verification]
 *       - name: planId
 *         in: query
 *         description: Filtrer par plan
 *         schema:
 *           type: string
 *       - name: days
 *         in: query
 *         description: Nombre de jours pour les statistiques (défaut 30)
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Liste des abonnements abandonnés
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                 stats:
 *                   type: object
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return authMiddleware(request, async (user) => {
    // Vérifier que l'utilisateur est admin
    if (!user.admin) {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    try {
      const { searchParams } = new URL(request.url);
      
      // Paramètres de pagination
      const page = parseInt(searchParams.get('page') || '1');
      const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
      const offset = (page - 1) * limit;

      // Paramètres de filtrage
      const status = searchParams.get('status');
      const step = searchParams.get('step');
      const planId = searchParams.get('planId');
      const days = parseInt(searchParams.get('days') || '30');

      // Construire les filtres
      const where: any = {};
      
      if (status && ['abandoned', 'recovered', 'expired'].includes(status)) {
        where.status = status;
      }
      
      if (step && ['plan_selection', 'user_registration', 'payment_method', 'payment_processing', 'payment_failed', 'email_verification'].includes(step)) {
        where.step = step;
      }
      
      if (planId) {
        where.planId = planId;
      }

      // Filtrer par période si spécifié
      if (days > 0) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        where.abandonedAt = { gte: since };
      }

      // Récupérer les données avec pagination
      const [abandonedSubscriptions, total, stats] = await Promise.all([
        prisma.abandonedSubscription.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                createdAt: true
              }
            },
            plan: {
              select: {
                id: true,
                title: true,
                monthlyPrice: true,
                yearlyPrice: true,
                amountCurrency: true
              }
            },
            completedSubscription: {
              select: {
                id: true,
                reference: true,
                createdAt: true
              }
            },
            activities: {
              orderBy: { timestamp: 'desc' },
              take: 5,
              select: {
                id: true,
                step: true,
                action: true,
                timestamp: true,
                metadata: true
              }
            }
          },
          orderBy: { lastActivityAt: 'desc' },
          skip: offset,
          take: limit
        }),

        // Compter le total
        prisma.abandonedSubscription.count({ where }),

        // Récupérer les statistiques
        getAbandonedSubscriptionStats(days)
      ]);

      // Calculer les métadonnées de pagination
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return NextResponse.json({
        data: abandonedSubscriptions.map(subscription => ({
          ...subscription,
          // Calculer le montant potentiel perdu
          potentialValue: subscription.period === 'month' 
            ? subscription.plan.monthlyPrice 
            : subscription.plan.yearlyPrice,
          // Temps écoulé depuis l'abandon
          abandonedDuration: Date.now() - new Date(subscription.abandonedAt).getTime(),
          // Dernière activité
          lastActivity: subscription.activities[0] || null
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage
        },
        stats,
        filters: {
          status,
          step,
          planId,
          days
        }
      });

    } catch (error) {
      console.error('Error fetching abandoned subscriptions:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des données' },
        { status: 500 }
      );
    }
  });
}