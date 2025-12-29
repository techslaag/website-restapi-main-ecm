import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/app-config/[key]
 * Get specific app configuration setting
 */
export async function GET(request: Request, { params }: { params: { key: string } }) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const config = await prisma.appConfig.findUnique({
        where: { key: params.key },
      });

      if (!config) {
        return Response.json(
          { error: "Configuration not found" },
          { status: 404 }
        );
      }

      return Response.json({ config });
    } catch (error) {
      console.error("Error fetching app config:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}

/**
 * PUT /api/admin/app-config/[key]
 * Update specific app configuration setting
 */
export async function PUT(request: Request, { params }: { params: { key: string } }) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const { value, description } = await request.json();

      const config = await prisma.appConfig.upsert({
        where: { key: params.key },
        update: {
          value,
          description,
          updatedAt: new Date(),
        },
        create: {
          key: params.key,
          value,
          description,
        },
      });

      return Response.json({
        config,
        message: "Configuration updated successfully",
      });
    } catch (error) {
      console.error("Error updating app config:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}

/**
 * DELETE /api/admin/app-config/[key]
 * Delete specific app configuration setting
 */
export async function DELETE(request: Request, { params }: { params: { key: string } }) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      await prisma.appConfig.delete({
        where: { key: params.key },
      });

      return Response.json({
        message: "Configuration deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting app config:", error);
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        return Response.json(
          { error: "Configuration not found" },
          { status: 404 }
        );
      }
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}