import { NextRequest, NextResponse } from 'next/server';
import { markExpiredAbandoned } from '@/lib/utils/abandonedSubscriptionTracker';
import { serializeError } from 'serialize-error';

/**
 * @swagger
 * /cron/abandoned-subscriptions-cleanup:
 *   post:
 *     summary: Nettoie les abonnements abandonnés expirés
 *     description: Marque comme expirés les abonnements abandonnés depuis plus de X jours
 *     tags:
 *       - Cron
 *       - Abandoned Subscriptions
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               daysOld:
 *                 type: integer
 *                 description: Nombre de jours après lesquels marquer comme expiré (défaut 30)
 *                 default: 30
 *     responses:
 *       200:
 *         description: Nettoyage effectué avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 updated:
 *                   type: integer
 *                   description: Nombre d'enregistrements mis à jour
 *                 message:
 *                   type: string
 *       500:
 *         description: Erreur serveur
 */

export const dynamic = "force-dynamic";
export const maxDuration = 1800; // 30 minutes (1800 seconds)

export async function POST(request: NextRequest) {
  try {
    // Vérifier l'autorisation cron (optionnel)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Récupérer les paramètres
    let daysOld = 30; // Par défaut, expirer après 30 jours
    
    try {
      const body = await request.json();
      if (body.daysOld && typeof body.daysOld === 'number') {
        daysOld = body.daysOld;
      }
    } catch {
      // Ignorer les erreurs de parsing du body, utiliser les valeurs par défaut
    }

    console.log(`[Cron] Starting abandoned subscriptions cleanup (${daysOld} days old)`);

    // Marquer les abonnements abandonnés comme expirés
    const result = await markExpiredAbandoned(daysOld);

    console.log(`[Cron] Abandoned subscriptions cleanup completed: ${result.count} records updated`);

    return NextResponse.json({
      success: true,
      updated: result.count,
      message: `${result.count} abonnements abandonnés marqués comme expirés`,
      daysOld,
      executedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Cron] Error in abandoned subscriptions cleanup:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erreur lors du nettoyage',
        message: (error as Error).message,
        details: serializeError(error)
      },
      { status: 500 }
    );
  }
}