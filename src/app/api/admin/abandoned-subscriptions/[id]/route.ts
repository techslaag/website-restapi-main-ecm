import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import authMiddleware from '@/lib/auth/authMiddleware';
import { serializeError } from 'serialize-error';

/**
 * @swagger
 * /admin/abandoned-subscriptions/{id}:
 *   get:
 *     summary: Récupérer les détails d'un abonnement abandonné
 *     description: Obtient tous les détails d'un abonnement abandonné spécifique
 *     tags:
 *       - Admin
 *       - Abandoned Subscriptions
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID de l'abonnement abandonné
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails de l'abonnement abandonné
 *       404:
 *         description: Abonnement abandonné non trouvé
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params: { id } }: { params: { id: string } }
) {
  return authMiddleware(request, async (user) => {
    // Vérifier que l'utilisateur est admin
    if (!user.admin) {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    try {
      const abandonedSubscription = await prisma.abandonedSubscription.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
              signUpType: true,
              locale: true
            }
          },
          plan: {
            select: {
              id: true,
              title: true,
              description: true,
              monthlyPrice: true,
              yearlyPrice: true,
              amountCurrency: true,
              planType: true
            }
          },
          completedSubscription: {
            select: {
              id: true,
              reference: true,
              createdAt: true,
              expiresAt: true
            }
          },
          activities: {
            orderBy: { timestamp: 'desc' },
            select: {
              id: true,
              step: true,
              action: true,
              timestamp: true,
              metadata: true
            }
          }
        }
      });

      if (!abandonedSubscription) {
        return NextResponse.json(
          { error: 'Abonnement abandonné non trouvé' },
          { status: 404 }
        );
      }

      // Calculer des métriques utiles
      const potentialValue = abandonedSubscription.period === 'month' 
        ? abandonedSubscription.plan.monthlyPrice 
        : abandonedSubscription.plan.yearlyPrice;

      const abandonedDuration = Date.now() - new Date(abandonedSubscription.abandonedAt).getTime();
      const daysSinceAbandoned = Math.floor(abandonedDuration / (1000 * 60 * 60 * 24));

      // Analyser le parcours utilisateur
      const userJourney = abandonedSubscription.activities.map(activity => ({
        ...activity,
        timeFromStart: new Date(activity.timestamp).getTime() - new Date(abandonedSubscription.createdAt).getTime(),
        formattedTime: new Date(activity.timestamp).toISOString()
      }));

      return NextResponse.json({
        ...abandonedSubscription,
        potentialValue,
        abandonedDuration,
        daysSinceAbandoned,
        userJourney,
        analytics: {
          stepsCompleted: userJourney.length,
          timeSpentInProcess: userJourney.length > 0 
            ? userJourney[0].timeFromStart 
            : 0,
          lastActiveStep: abandonedSubscription.step,
          hasContactInfo: !!abandonedSubscription.email,
          isRegisteredUser: !!abandonedSubscription.userId,
          trafficSource: {
            utm_source: abandonedSubscription.utmSource,
            utm_medium: abandonedSubscription.utmMedium,
            utm_campaign: abandonedSubscription.utmCampaign,
            referrer: abandonedSubscription.referrer
          }
        }
      });

    } catch (error) {
      console.error('Error fetching abandoned subscription details:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des détails' },
        { status: 500 }
      );
    }
  });
}

/**
 * @swagger
 * /admin/abandoned-subscriptions/{id}:
 *   patch:
 *     summary: Mettre à jour un abonnement abandonné
 *     description: Permet de changer le statut ou d'ajouter des notes
 *     tags:
 *       - Admin
 *       - Abandoned Subscriptions
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID de l'abonnement abandonné
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [abandoned, recovered, expired]
 *               remindersSent:
 *                 type: integer
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Abonnement abandonné mis à jour
 *       404:
 *         description: Abonnement abandonné non trouvé
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */

export async function PATCH(
  request: NextRequest,
  { params: { id } }: { params: { id: string } }
) {
  return authMiddleware(request, async (user) => {
    // Vérifier que l'utilisateur est admin
    if (!user.admin) {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    try {
      const body = await request.json();
      const { status, remindersSent, metadata } = body;

      // Vérifier que l'abonnement existe
      const existing = await prisma.abandonedSubscription.findUnique({
        where: { id }
      });

      if (!existing) {
        return NextResponse.json(
          { error: 'Abonnement abandonné non trouvé' },
          { status: 404 }
        );
      }

      // Préparer les données de mise à jour
      const updateData: any = {
        updatedAt: new Date()
      };

      if (status && ['abandoned', 'recovered', 'expired'].includes(status)) {
        updateData.status = status;
        if (status === 'recovered' && !existing.recoveredAt) {
          updateData.recoveredAt = new Date();
        }
      }

      if (typeof remindersSent === 'number') {
        updateData.remindersSent = remindersSent;
      }

      if (metadata) {
        updateData.metadata = {
          ...((existing.metadata as any) || {}),
          ...metadata,
          adminUpdate: {
            updatedBy: user.id,
            updatedAt: new Date().toISOString(),
            previousStatus: existing.status
          }
        };
      }

      // Mettre à jour l'abonnement abandonné
      const updated = await prisma.abandonedSubscription.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          plan: {
            select: {
              id: true,
              title: true
            }
          }
        }
      });

      // Enregistrer l'activité admin
      await prisma.abandonedSubscriptionActivity.create({
        data: {
          abandonedSubscriptionId: id,
          step: existing.step,
          action: 'admin_update',
          metadata: JSON.stringify({
            adminId: user.id,
            adminEmail: user.email,
            changes: body,
            previousStatus: existing.status
          })
        }
      });

      return NextResponse.json(updated);

    } catch (error) {
      console.error('Error updating abandoned subscription:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour' },
        { status: 500 }
      );
    }
  });
}