import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * App Configuration Endpoint
 *
 * Returns mobile app configuration values that can be controlled server-side
 * without requiring app updates. Configuration is stored in database only.
 *
 * GET /api/app-config
 *
 * Response:
 * {
 *   "showOtherPaymentMethods": boolean,  // Controls visibility of Stripe/Mobile Money on iOS
 *   "maintenanceMode": boolean,          // App-wide maintenance flag
 *   "features": {                        // Feature flags
 *     "tts": boolean,
 *     "offline": boolean,
 *   }
 * }
 */

/**
 * Helper function to get config value from database
 */
async function getConfigValue(key: string): Promise<string | null> {
  try {
    const config = await prisma.appConfig.findUnique({
      where: { key },
      select: { value: true },
    });
    return config?.value ?? null;
  } catch (error) {
    console.error(`[App Config] Error fetching ${key} from database:`, error);
    return null;
  }
}

export async function GET() {
  try {
    // Fetch configuration from database only
    const [
      showOtherPaymentMethods,
      maintenanceMode,
      featureTts,
      featureOffline,
    ] = await Promise.all([
      getConfigValue('showOtherPaymentMethods'),
      getConfigValue('maintenanceMode'),
      getConfigValue('featureTts'),
      getConfigValue('featureOffline'),
    ]);

    // If any required config is missing, return error
    if (!showOtherPaymentMethods || !maintenanceMode || !featureTts || !featureOffline) {
      console.error('[App Config] Missing required configuration values in database');
      return NextResponse.json({
        error: 'Configuration not properly initialized. Please contact administrator.',
      }, {
        status: 500,
      });
    }

    const config = {
      // Payment method visibility
      // Set to false to hide Stripe/Mobile Money on iOS (for App Store review)
      // Set to true to show all payment methods
      showOtherPaymentMethods: showOtherPaymentMethods === 'true',

      // Maintenance mode flag
      maintenanceMode: maintenanceMode === 'true',

      // Feature flags
      features: {
        tts: featureTts === 'true',
        offline: featureOffline === 'true',
      },
    };

    return NextResponse.json(config, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error('[App Config] Error fetching config:', error);

    return NextResponse.json({
      error: 'Unable to fetch configuration. Please try again later.',
    }, {
      status: 500,
    });
  }
}
