import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/app-config/init
 * Initialize default app configuration settings
 */
export async function POST(request: Request) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const defaultConfigs = [
        {
          key: "showOtherPaymentMethods",
          value: "false",
          description: "Controls visibility of Stripe/Mobile Money on iOS (for App Store review)",
        },
        {
          key: "maintenanceMode",
          value: "false",
          description: "App-wide maintenance flag",
        },
        {
          key: "featureTts",
          value: "true",
          description: "Text-to-speech feature flag",
        },
        {
          key: "featureOffline",
          value: "true",
          description: "Offline mode feature flag",
        },
      ];

      const results = [];

      for (const config of defaultConfigs) {
        const result = await prisma.appConfig.upsert({
          where: { key: config.key },
          update: {}, // Don't update if exists
          create: config,
        });
        results.push(result);
      }

      return Response.json({
        configs: results,
        message: "Default configurations initialized successfully",
      });
    } catch (error) {
      console.error("Error initializing app configs:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}