import prisma from "@/lib/prisma";

export interface FcmTokenWithUser {
  id: string;
  token: string;
  userId: string;
  deviceId: string | null;
  platform: string | null;
  appVersion: string | null;
  isActive: boolean;
  lastUsed: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    admin: boolean;
    preferences?: {
      id: string;
      categories: string;
    } | null;
  };
}

export interface UserWithTokens {
  id: string;
  name: string | null;
  email: string | null;
  admin: boolean;
  preferences: {
    id: string;
    categories: string;
  } | null;
  tokens: string[];
  deviceCount: number;
  hasToken: boolean;
  tokenPreview: string | null;
  categories: string[];
}

/**
 * Get all active FCM tokens with their associated user information efficiently
 * Only returns tokens that have valid user associations
 */
export async function getAllFcmTokensWithUsers(): Promise<FcmTokenWithUser[]> {
  return await prisma.fcmToken.findMany({
    where: { 
      isActive: true,
      user: {
        id: { not: undefined }  // Only include tokens where user exists
      }
    },
    include: {
      user: {
        include: {
          preferences: true
        }
      }
    },
    orderBy: { lastUsed: 'desc' }
  });
}

/**
 * Get FCM tokens for a specific user
 */
export async function getFcmTokensByUserId(userId: string): Promise<FcmTokenWithUser[]> {
  return await prisma.fcmToken.findMany({
    where: { 
      userId,
      isActive: true 
    },
    include: {
      user: {
        include: {
          preferences: true
        }
      }
    },
    orderBy: { lastUsed: 'desc' }
  });
}

/**
 * Get users with their FCM tokens grouped efficiently
 */
export async function getUsersWithFcmTokens(): Promise<UserWithTokens[]> {
  const fcmTokensWithUsers = await getAllFcmTokensWithUsers();
  
  // Group tokens by user
  const userTokenMap = new Map<string, UserWithTokens>();
  
  for (const tokenRecord of fcmTokensWithUsers) {
    const userId = tokenRecord.userId;
    
    if (!userTokenMap.has(userId)) {
      const user = tokenRecord.user;
      const categories = parseCategories(user.preferences?.categories || '');
      
      userTokenMap.set(userId, {
        id: user.id,
        name: user.name,
        email: user.email,
        admin: user.admin,
        preferences: user.preferences ? {
          id: user.preferences.id,
          categories: user.preferences.categories
        } : null,
        tokens: [],
        categories,
        deviceCount: 0,
        hasToken: false,
        tokenPreview: null
      });
    }
    
    const userRecord = userTokenMap.get(userId)!;
    userRecord.tokens.push(tokenRecord.token);
  }
  
  // Convert to array and add computed fields
  return Array.from(userTokenMap.values()).map(user => ({
    ...user,
    deviceCount: user.tokens.length,
    hasToken: user.tokens.length > 0,
    tokenPreview: user.tokens.length > 0 
      ? `${user.tokens[0].substring(0, 20)}... (+${user.tokens.length - 1} more)`
      : null
  }));
}

/**
 * Get only FCM tokens (strings) for notifications
 * Only returns tokens that have valid user associations
 */
export async function getAllActiveFcmTokens(): Promise<string[]> {
  const tokens = await prisma.fcmToken.findMany({
    where: { 
      isActive: true,
      user: {
        id: { not: undefined }  // Only include tokens where user exists
      }
    },
    select: { token: true },
    orderBy: { lastUsed: 'desc' }
  });
  
  return tokens.map(t => t.token);
}

/**
 * Get FCM tokens for multiple users
 */
export async function getFcmTokensByUserIds(userIds: string[]): Promise<string[]> {
  const tokens = await prisma.fcmToken.findMany({
    where: { 
      userId: { in: userIds },
      isActive: true 
    },
    select: { token: true },
    orderBy: { lastUsed: 'desc' }
  });
  
  return tokens.map(t => t.token);
}

/**
 * Get notification statistics efficiently
 */
export async function getFcmStatistics() {
  const [fcmStats, platformStats, totalUsers, adminUsers] = await Promise.all([
    // Get FCM token count (only tokens with valid users)
    prisma.fcmToken.aggregate({
      where: { 
        isActive: true,
        user: {
          id: { not: undefined }  // Only count tokens where user exists
        }
      },
      _count: { id: true }
    }),
    
    // Get platform breakdown (only tokens with valid users)
    prisma.fcmToken.groupBy({
      by: ['platform'],
      where: { 
        isActive: true,
        user: {
          id: { not: undefined }  // Only count tokens where user exists
        }
      },
      _count: { platform: true }
    }),
    
    // Get total users
    prisma.user.count(),
    
    // Get admin users
    prisma.user.count({
      where: { admin: true }
    })
  ]);

  // Get unique users with tokens (exclude null users)
  const uniqueUsers = await prisma.fcmToken.groupBy({
    by: ['userId'],
    where: { 
      isActive: true,
      user: {
        id: { not: undefined }  // Only count tokens where user exists
      }
    },
    _count: { userId: true }
  });

  const usersWithTokens = uniqueUsers.length;
  const totalTokens = fcmStats._count.id;
  
  const devicePlatforms = platformStats.reduce((acc, stat) => {
    acc[stat.platform || 'unknown'] = stat._count.platform;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalUsers,
    usersWithTokens,
    usersWithoutTokens: totalUsers - usersWithTokens,
    adminUsers,
    activePreferences: usersWithTokens,
    totalTokens,
    averageTokensPerUser: usersWithTokens > 0 ? (totalTokens / usersWithTokens).toFixed(2) : '0',
    tokenCoverage: totalUsers > 0 ? ((usersWithTokens / totalUsers) * 100).toFixed(2) + '%' : '0%',
    devicePlatforms
  };
}

/**
 * Parse categories string to array
 */
function parseCategories(categoriesStr: string): string[] {
  try {
    if (!categoriesStr) return [];
    
    // Try to parse as JSON array first
    try {
      const parsed = JSON.parse(categoriesStr);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // If JSON parse fails, try comma-separated values
      return categoriesStr.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
    }
    
    return [];
  } catch (error) {
    console.error('Error parsing categories:', error);
    return [];
  }
}