import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/app-config
 * Get all app configuration settings
 */
export async function GET(request: Request) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const configs = await prisma.appConfig.findMany({
        orderBy: {
          key: "asc",
        },
      });

      return Response.json({
        configs,
        message: `${configs.length} configurations found`,
      });
    } catch (error) {
      console.error("Error fetching app configs:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}

/**
 * POST /api/admin/app-config
 * Create or update app configuration setting
 */
export async function POST(request: Request) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const { key, value, description } = await request.json();

      if (!key) {
        return Response.json(
          { error: "Key is required" },
          { status: 400 }
        );
      }

      const config = await prisma.appConfig.upsert({
        where: { key },
        update: {
          value,
          description,
          updatedAt: new Date(),
        },
        create: {
          key,
          value,
          description,
        },
      });

      return Response.json({
        config,
        message: "Configuration saved successfully",
      });
    } catch (error) {
      console.error("Error saving app config:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}

/**
 * DELETE /api/admin/app-config
 * Delete app configuration setting
 */
export async function DELETE(request: Request) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const { key } = await request.json();

      if (!key) {
        return Response.json(
          { error: "Key is required" },
          { status: 400 }
        );
      }

      await prisma.appConfig.delete({
        where: { key },
      });

      return Response.json({
        message: "Configuration deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting app config:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}