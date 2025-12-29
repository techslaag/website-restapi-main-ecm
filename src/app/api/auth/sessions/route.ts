import authMiddleware from "@/lib/auth/authMiddleware";
import { getPaginatedResult } from "@/lib/utils/databaseUtils";
import { getDeviceTypeDisplayName } from "@/lib/utils/deviceUtils";
import { extractQueryParams } from "@/lib/utils/index";
import { getUserActiveSessionsByDevice } from "@/lib/utils/sessionUtils";

export const dynamic = "force-dynamic";

/**
 * Get all the current user's active sessions
 *
 * @param request client request
 * @returns Response
 */
export async function GET(request: Request) {
  return authMiddleware(request, async (user) => {
    const queryParams: { page: string; limit: string; grouped?: string } =
      extractQueryParams(request);

    // If grouped=true, return sessions grouped by device type
    if (queryParams.grouped === "true") {
      const groupedSessions = await getUserActiveSessionsByDevice(user.id);
      
      // Add display names for device types
      const sessionsWithDisplayNames = groupedSessions.sessions.map(session => ({
        ...session,
        deviceTypeDisplay: getDeviceTypeDisplayName(session.deviceType),
      }));

      const byDeviceWithDisplayNames = Object.entries(groupedSessions.byDevice).reduce((acc, [deviceType, sessions]) => {
        acc[deviceType] = sessions.map(session => ({
          ...session,
          deviceTypeDisplay: getDeviceTypeDisplayName(session.deviceType),
        }));
        return acc;
      }, {} as any);

      return Response.json({
        total: groupedSessions.total,
        maxAllowed: 4,
        byDevice: byDeviceWithDisplayNames,
        sessions: sessionsWithDisplayNames,
      });
    }

    // Regular paginated response
    const paginatedResponse = await getPaginatedResult(
      "Session",
      Number(queryParams.page ?? 1),
      Number(queryParams.limit ?? 10),
      {
        where: {
          userId: user.id,
          expires: {
            gt: new Date(),
          },
        },
        select: {
          id: true,
          createdAt: true,
          expires: true,
          userAgent: true,
          userIpAddress: true,
          deviceType: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }
    );

    // Add device type display names to paginated results
    if (paginatedResponse.items) {
      paginatedResponse.items = paginatedResponse.items.map((session: any) => ({
        ...session,
        deviceTypeDisplay: getDeviceTypeDisplayName(session.deviceType),
      }));
    }

    return Response.json(paginatedResponse);
  });
}
