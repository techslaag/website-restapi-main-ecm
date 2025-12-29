import { DeviceType } from "@prisma/client";
import prisma from "../prisma";
import { DEVICE_SESSION_LIMITS, MAX_TOTAL_SESSIONS } from "./deviceUtils";

/**
 * Check if user can create a new session for the specified device type
 * @param userId - The user ID
 * @param deviceType - The device type for the new session
 * @returns Promise<{ canCreate: boolean; reason?: string }>
 */
export async function canCreateSession(
  userId: string,
  deviceType: DeviceType
): Promise<{ canCreate: boolean; reason?: string }> {
  // Get all active sessions for the user
  const activeSessions = await prisma.session.findMany({
    where: {
      userId,
      expires: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      deviceType: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // Check total session limit
  if (activeSessions.length >= MAX_TOTAL_SESSIONS) {
    return {
      canCreate: false,
      reason: `Maximum de ${MAX_TOTAL_SESSIONS} sessions actives atteint`,
    };
  }

  // Check device type specific limit
  const deviceSessions = activeSessions.filter(
    (session) => session.deviceType === deviceType
  );

  if (deviceSessions.length >= DEVICE_SESSION_LIMITS[deviceType]) {
    return {
      canCreate: false,
      reason: `Maximum d'une session active par type d'appareil atteint`,
    };
  }

  return { canCreate: true };
}

/**
 * Clean up old sessions for a device type when limit is exceeded
 * This will remove the oldest session for the device type
 * @param userId - The user ID
 * @param deviceType - The device type to clean up
 */
export async function cleanupOldSessionsForDeviceType(
  userId: string,
  deviceType: DeviceType
): Promise<void> {
  const deviceSessions = await prisma.session.findMany({
    where: {
      userId,
      deviceType,
      expires: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // If we have sessions that exceed the limit, delete the oldest ones
  const excessSessions = deviceSessions.length - DEVICE_SESSION_LIMITS[deviceType] + 1;
  if (excessSessions > 0) {
    const sessionsToDelete = deviceSessions.slice(0, excessSessions);
    const sessionIds = sessionsToDelete.map((session) => session.id);

    await prisma.session.deleteMany({
      where: {
        id: {
          in: sessionIds,
        },
      },
    });
  }
}

/**
 * Clean up old sessions to make room for a new session
 * This will remove the oldest session across all device types if total limit is exceeded
 * @param userId - The user ID
 */
export async function cleanupOldestSession(userId: string): Promise<void> {
  const activeSessions = await prisma.session.findMany({
    where: {
      userId,
      expires: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // If we're at or above the total limit, delete the oldest session
  if (activeSessions.length >= MAX_TOTAL_SESSIONS) {
    const oldestSession = activeSessions[0];
    await prisma.session.delete({
      where: {
        id: oldestSession.id,
      },
    });
  }
}

/**
 * Get user's active sessions grouped by device type
 * @param userId - The user ID
 * @returns Promise with sessions grouped by device type
 */
export async function getUserActiveSessionsByDevice(userId: string) {
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      expires: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      deviceType: true,
      createdAt: true,
      expires: true,
      userAgent: true,
      userIpAddress: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Group sessions by device type
  const groupedSessions = sessions.reduce((acc, session) => {
    if (!acc[session.deviceType]) {
      acc[session.deviceType] = [];
    }
    acc[session.deviceType].push(session);
    return acc;
  }, {} as Record<DeviceType, typeof sessions>);

  return {
    total: sessions.length,
    byDevice: groupedSessions,
    sessions,
  };
}