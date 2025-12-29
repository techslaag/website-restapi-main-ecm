import { NextRequest, NextResponse } from 'next/server';
import { AbandonedSubscriptionStep } from '@prisma/client';
import { 
  trackAbandonedSubscription, 
  extractTrackingInfo, 
  generateSessionId 
} from '@/lib/utils/abandonedSubscriptionTracker';

interface TrackingMiddlewareOptions {
  step: AbandonedSubscriptionStep;
  extractPlanId?: (request: NextRequest) => string | null;
  extractUserId?: (request: NextRequest) => string | null;
  extractEmail?: (request: NextRequest) => string | null;
  extractPeriod?: (request: NextRequest) => 'month' | 'year' | 'week';
  skipCondition?: (request: NextRequest) => boolean;
}

/**
 * Middleware pour tracker automatiquement les abandons d'abonnement
 */
export function createAbandonedSubscriptionMiddleware(options: TrackingMiddlewareOptions) {
  return async (request: NextRequest, response: NextResponse) => {
    try {
      // Vérifier la condition de skip
      if (options.skipCondition && options.skipCondition(request)) {
        return response;
      }

      // Extraire les informations nécessaires
      const planId = options.extractPlanId ? options.extractPlanId(request) : null;
      
      if (!planId) {
        // Pas de planId disponible, on ne peut pas tracker
        return response;
      }

      const userId = options.extractUserId ? options.extractUserId(request) : null;
      const email = options.extractEmail ? options.extractEmail(request) : null;
      const period = options.extractPeriod ? options.extractPeriod(request) : 'month';

      // Générer ou récupérer l'ID de session
      const sessionId = generateSessionId(request as any);

      // Extraire les informations de tracking
      const trackingInfo = extractTrackingInfo(request as any);

      // Tracker l'abandon
      await trackAbandonedSubscription({
        sessionId,
        userId: userId || undefined,
        planId,
        period,
        email: email || undefined,
        step: options.step,
        ...trackingInfo,
        metadata: {
          route: request.url,
          method: request.method,
          timestamp: new Date().toISOString()
        }
      });

      // Ajouter l'ID de session aux cookies de response si pas déjà présent
      const existingSessionId = request.cookies.get('session_id');
      if (!existingSessionId) {
        response.cookies.set('session_id', sessionId, {
          maxAge: 60 * 60 * 24 * 30, // 30 jours
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax'
        });
      }

    } catch (error) {
      console.error('Error in abandoned subscription middleware:', error);
      // Ne pas bloquer la requête en cas d'erreur de tracking
    }

    return response;
  };
}

/**
 * Middleware spécifique pour la page de sélection de plan
 */
export const trackPlanSelectionMiddleware = createAbandonedSubscriptionMiddleware({
  step: 'plan_selection',
  extractPlanId: (request) => {
    // Extraire depuis l'URL ou les paramètres
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const planIndex = pathSegments.findIndex(segment => segment === 'subscription');
    return planIndex !== -1 && pathSegments[planIndex + 1] ? pathSegments[planIndex + 1] : null;
  },
  extractPeriod: (request) => {
    const url = new URL(request.url);
    const period = url.searchParams.get('period');
    return ['month', 'year', 'week'].includes(period || '') ? period as any : 'month';
  }
});

/**
 * Middleware spécifique pour la page d'inscription
 */
export const trackUserRegistrationMiddleware = createAbandonedSubscriptionMiddleware({
  step: 'user_registration',
  extractPlanId: (request) => {
    // Récupérer depuis les cookies ou session storage
    return request.cookies.get('selected_plan_id')?.value || null;
  },
  extractPeriod: (request) => {
    const period = request.cookies.get('selected_period')?.value;
    return ['month', 'year', 'week'].includes(period || '') ? period as any : 'month';
  }
});

/**
 * Middleware spécifique pour la page de méthode de paiement
 */
export const trackPaymentMethodMiddleware = createAbandonedSubscriptionMiddleware({
  step: 'payment_method',
  extractPlanId: (request) => {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const planIndex = pathSegments.findIndex(segment => segment === 'subscription');
    return planIndex !== -1 && pathSegments[planIndex + 1] ? pathSegments[planIndex + 1] : null;
  },
  extractUserId: (request) => {
    // Extraire depuis le token d'authentification
    // Cette fonction devrait être adaptée selon votre système d'authentification
    try {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        // Décoder le JWT pour extraire l'userId
        // Implémentation dépendante de votre système d'auth
        return null; // Placeholder
      }
    } catch (error) {
      console.error('Error extracting user ID:', error);
    }
    return null;
  }
});

/**
 * Fonction utilitaire pour tracker manuellement un abandon à une étape spécifique
 */
export async function trackManualAbandonment(
  request: NextRequest,
  step: AbandonedSubscriptionStep,
  planId: string,
  userId?: string,
  email?: string,
  additionalMetadata?: any
) {
  try {
    const sessionId = generateSessionId(request as any);
    const trackingInfo = extractTrackingInfo(request as any);

    return await trackAbandonedSubscription({
      sessionId,
      userId,
      planId,
      period: 'month', // Valeur par défaut
      email,
      step,
      ...trackingInfo,
      metadata: {
        manualTracking: true,
        route: request.url,
        ...additionalMetadata
      }
    });
  } catch (error) {
    console.error('Error in manual abandonment tracking:', error);
    throw error;
  }
}