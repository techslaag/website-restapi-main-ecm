import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import admin from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/utils/rateLimit";
import { validateApiKey, requireAdminAuth } from "@/lib/middleware/auth";
import { logNotificationActivity } from "@/lib/utils/logging";
import { 
  getAllActiveFcmTokens, 
  getFcmTokensByUserId, 
  getFcmStatistics,
  getUsersWithFcmTokens
} from "@/lib/fcm-service";
import { NOTIFICATION_TYPES, isValidNotificationType, type NotificationTypeValue } from "@/lib/notifications/fcmService";

// Rate limiting: 100 requests per minute for notifications
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Rate limiting
    const identifier = request.ip || request.headers.get('x-forwarded-for') || 'anonymous';
    await limiter.check(10, identifier); // 10 requests per minute per IP

    // Authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.success) {
      await logNotificationActivity({
        requestId,
        action: 'firebase_notification_send',
        userId: null,
        status: 'unauthorized',
        error: authResult.error,
        metadata: { ip: identifier }
      });
      
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const { 
      type, 
      title, 
      body, 
      targetUserId, 
      customFcmToken,
      data,
      audience, // 'all', 'segment', 'user', 'custom'
      segmentCriteria, // For targeted campaigns
      scheduledAt, // For scheduling
      priority, // 'high', 'normal', 'low'
      templateId, // For template-based notifications
      campaignId, // For campaign tracking
      notification_type, // New: type of notification for mobile app handling
      route, // New: deep link route for mobile app navigation
      dryRun = false // For preview without sending
    } = await request.json();

    // Enhanced validation
    const validation = validateNotificationRequest({
      type, title, body, audience, targetUserId, customFcmToken, notification_type, route
    });
    
    if (!validation.isValid) {
      await logNotificationActivity({
        requestId,
        action: 'firebase_notification_send',
        userId: authResult.user.id,
        status: 'validation_failed',
        error: validation.errors.join(', '),
        metadata: { audience, type }
      });
      
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      );
    }

    // Check if scheduled for future
    if (scheduledAt && new Date(scheduledAt) > new Date()) {
      const scheduledNotification = await scheduleNotification({
        requestId,
        userId: authResult.user.id,
        type, title, body, audience, targetUserId, customFcmToken,
        data, segmentCriteria, priority, templateId, campaignId,
        scheduledAt
      });

      await logNotificationActivity({
        requestId,
        action: 'firebase_notification_scheduled',
        userId: authResult.user.id,
        status: 'success',
        metadata: { 
          notificationId: scheduledNotification.id,
          scheduledAt,
          audience 
        }
      });

      return NextResponse.json({
        success: true,
        message: "Notification scheduled successfully",
        notificationId: scheduledNotification.id,
        scheduledAt,
        requestId
      });
    }

    // Get target FCM tokens based on audience
    const { fcmTokens, targetCount } = await getTargetTokens({
      audience,
      targetUserId,
      customFcmToken,
      segmentCriteria
    });

    if (fcmTokens.length === 0) {
      await logNotificationActivity({
        requestId,
        action: 'firebase_notification_send',
        userId: authResult.user.id,
        status: 'no_targets',
        metadata: { audience, targetCount: 0 }
      });

      return NextResponse.json({
        success: false,
        message: "No valid FCM tokens found for the specified criteria",
        targetCount: 0,
        requestId
      });
    }

    // Prepare notification payload with enhanced mobile app data
    const notificationPayload = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        requestId,
        notification_type: notification_type || 'new_article',
        route: route || '',
        legacy_type: type, // Keep backward compatibility
        priority: priority || 'normal',
        campaignId: campaignId || '',
        timestamp: new Date().toISOString(),
        click_action: route ? `FLUTTER_NOTIFICATION_CLICK_${route}` : 'FLUTTER_NOTIFICATION_CLICK',
        ...data
      },
      android: {
        priority: priority === 'high' ? 'high' : 'normal',
        notification: {
          channelId: type,
          priority: priority === 'high' ? 'high' : 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: title,
              body: body
            },
            badge: 1,
            sound: priority === 'high' ? 'critical.aiff' : 'default'
          }
        }
      }
    };

    let results: { successCount: number; failureCount: number; responses: any[] } = { 
      successCount: 0, 
      failureCount: 0, 
      responses: [] 
    };

    if (!dryRun) {
      // Send notifications in batches for better performance
      results = await sendNotificationsInBatches(fcmTokens, notificationPayload);
    } else {
      // Dry run simulation
      results = {
        successCount: fcmTokens.length,
        failureCount: 0,
        responses: fcmTokens.map(() => ({ success: true, preview: true }))
      };
    }

    // Store notification record
    const notificationRecord = await prisma.notificationLog.create({
      data: {
        requestId,
        type,
        title,
        body,
        audience,
        targetCount: fcmTokens.length,
        successCount: results.successCount,
        failureCount: results.failureCount,
        userId: authResult.user.id,
        campaignId,
        priority: priority || 'normal',
        dryRun,
        metadata: JSON.stringify({
          segmentCriteria,
          notification_type: notification_type || 'new_article',
          route: route || '',
          data,
          responseTime: Date.now() - startTime
        })
      }
    });

    // Log successful operation
    await logNotificationActivity({
      requestId,
      action: 'firebase_notification_send',
      userId: authResult.user.id,
      status: 'success',
      metadata: {
        notificationId: notificationRecord.id,
        audience,
        targetCount: fcmTokens.length,
        successCount: results.successCount,
        failureCount: results.failureCount,
        dryRun,
        responseTime: Date.now() - startTime
      }
    });

    return NextResponse.json({
      success: true,
      message: `${dryRun ? 'Preview completed' : 'Notifications sent'}`,
      results: {
        requestId,
        notificationId: notificationRecord.id,
        targetCount: fcmTokens.length,
        successCount: results.successCount,
        failureCount: results.failureCount,
        successRate: fcmTokens.length > 0 ? (results.successCount / fcmTokens.length * 100).toFixed(2) + '%' : '0%',
        responseTime: Date.now() - startTime + 'ms',
        dryRun
      }
    });

  } catch (error) {
    console.error("Firebase notification error:", error);
    
    await logNotificationActivity({
      requestId,
      action: 'firebase_notification_send',
      userId: null,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: { responseTime: Date.now() - startTime }
    });

    if (error instanceof Error && error.message.includes('Rate limit')) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { 
        error: "Internal server error",
        requestId,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Enhanced GET endpoint for analytics and management
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    switch (action) {
      case 'analytics':
        return await getNotificationAnalytics(startDate || undefined, endDate || undefined);
      
      case 'campaigns':
        return await getCampaignStats(startDate || undefined, endDate || undefined, limit);
      
      case 'audience-stats':
      case 'stats':  // Alias for audience-stats to match frontend
        return await getAudienceStatistics();
      
      case 'recent-logs':
        return await getRecentNotificationLogs(limit);
        
      case 'performance':
        return await getPerformanceMetrics(startDate || undefined, endDate || undefined);
        
      case 'users':
        return await getUsersWithTokens(limit);

      default:
        return NextResponse.json({
          message: "Firebase Notification Management API",
          version: "2.0.0",
          endpoints: {
            "POST /api/notifications/firebase": "Send notifications with advanced targeting",
            "GET /api/notifications/firebase?action=analytics": "Get notification analytics",
            "GET /api/notifications/firebase?action=campaigns": "Get campaign statistics",
            "GET /api/notifications/firebase?action=audience-stats": "Get audience statistics",
            "GET /api/notifications/firebase?action=recent-logs": "Get recent notification logs",
            "GET /api/notifications/firebase?action=performance": "Get performance metrics",
            "GET /api/notifications/firebase?action=users": "Get users with FCM tokens"
          },
          supportedNotificationTypes: Object.values(NOTIFICATION_TYPES)
        });
    }

  } catch (error) {
    console.error("Get notification info error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper functions

function validateNotificationRequest(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.title?.trim()) errors.push("Title is required");
  if (!data.body?.trim()) errors.push("Body is required");
  if (!data.type?.trim()) errors.push("Notification type is required");
  if (!data.audience) errors.push("Audience type is required");

  // Validate notification type
  if (data.type && !isValidNotificationType(data.type)) {
    errors.push(`Invalid notification type. Valid types: ${Object.values(NOTIFICATION_TYPES).join(', ')}`);
  }

  // Validate notification_type if provided
  const validNotificationTypes = ['new_article', 'announcement', 'reminder', 'promotional', 'system', 'update'];
  if (data.notification_type && !validNotificationTypes.includes(data.notification_type)) {
    errors.push(`Invalid notification_type. Valid types: ${validNotificationTypes.join(', ')}`);
  }

  // Validate route format if provided
  if (data.route && data.route.trim() && !data.route.startsWith('/')) {
    errors.push("Route must start with '/' (e.g., '/articles/123')");
  }

  if (data.audience === 'user' && !data.targetUserId) {
    errors.push("Target user ID is required for user audience");
  }
  
  if (data.audience === 'custom' && !data.customFcmToken) {
    errors.push("Custom FCM token is required for custom audience");
  }

  if (data.title && data.title.length > 100) {
    errors.push("Title must be 100 characters or less");
  }

  if (data.body && data.body.length > 500) {
    errors.push("Body must be 500 characters or less");
  }

  if (data.route && data.route.length > 200) {
    errors.push("Route must be 200 characters or less");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

async function getTargetTokens({ audience, targetUserId, customFcmToken, segmentCriteria }: any) {
  let fcmTokens: string[] = [];
  let targetCount = 0;

  switch (audience) {
    case 'all':
      // Get all active FCM tokens efficiently using service
      fcmTokens = await getAllActiveFcmTokens();
      targetCount = fcmTokens.length;
      break;

    case 'segment':
      // Get segmented users based on criteria
      fcmTokens = await getSegmentedTokens(segmentCriteria);
      targetCount = fcmTokens.length;
      break;

    case 'user':
      // Get FCM tokens for a specific user using service
      const userTokenData = await getFcmTokensByUserId(targetUserId);
      fcmTokens = userTokenData.map(t => t.token);
      targetCount = fcmTokens.length;
      break;

    case 'custom':
      fcmTokens.push(customFcmToken);
      targetCount = 1;
      break;
  }

  return { fcmTokens, targetCount };
}

async function sendNotificationsInBatches(tokens: string[], payload: any) {
  const batchSize = 500; // Firebase limit is 500 per batch
  let totalSuccess = 0;
  let totalFailure = 0;
  const responses = [];

  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        ...payload
      });

      totalSuccess += response.successCount;
      totalFailure += response.failureCount;
      responses.push(...response.responses);

      // Handle failed tokens (cleanup invalid tokens)
      if (response.failureCount > 0) {
        await cleanupInvalidTokens(batch, response.responses);
      }

    } catch (error) {
      console.error(`Batch ${i / batchSize + 1} failed:`, error);
      totalFailure += batch.length;
    }
  }

  return {
    successCount: totalSuccess,
    failureCount: totalFailure,
    responses
  };
}

async function cleanupInvalidTokens(tokens: string[], responses: any[]) {
  const invalidTokens = tokens.filter((token, index) => {
    const response = responses[index];
    return !response.success && (
      response.error?.code === 'messaging/registration-token-not-registered' ||
      response.error?.code === 'messaging/invalid-registration-token'
    );
  });

  if (invalidTokens.length > 0) {
    // Clean up from FcmToken table only
    await prisma.fcmToken.updateMany({
      where: { token: { in: invalidTokens } },
      data: { isActive: false }
    });
    
    console.log(`Cleaned up ${invalidTokens.length} invalid FCM tokens from FcmToken table`);
  }
}

async function scheduleNotification(data: any) {
  return await prisma.scheduledNotification.create({
    data: {
      requestId: data.requestId,
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      audience: data.audience,
      targetUserId: data.targetUserId,
      customFcmToken: data.customFcmToken,
      data: JSON.stringify({
        ...data.data || {},
        notification_type: data.notification_type || 'new_article',
        route: data.route || ''
      }),
      segmentCriteria: JSON.stringify(data.segmentCriteria || {}),
      priority: data.priority || 'normal',
      templateId: data.templateId,
      campaignId: data.campaignId,
      scheduledAt: new Date(data.scheduledAt),
      status: 'scheduled'
    }
  });
}

async function getSegmentedTokens(criteria: any): Promise<string[]> {
  // Get FCM tokens with user information for segmentation
  const where: any = { isActive: true };
  
  // Build efficient query with user filters
  if (criteria.categories) {
    where.user = {};
    
    if (criteria.categories) {
      where.user.preferences = {
        categories: { contains: criteria.categories }
      };
    }
  }

  const fcmTokenRecords = await prisma.fcmToken.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          preferences: {
            select: {
              categories: true
            }
          }
        }
      }
    },
    orderBy: { lastUsed: 'desc' },
    take: criteria.limit || 10000
  });

  return fcmTokenRecords.map(record => record.token);
}

async function getNotificationAnalytics(startDate?: string, endDate?: string) {
  const dateFilter: any = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  const stats = await prisma.notificationLog.aggregate({
    where: dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {},
    _sum: {
      targetCount: true,
      successCount: true,
      failureCount: true
    },
    _count: true
  });

  const byType = await prisma.notificationLog.groupBy({
    by: ['type'],
    where: dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {},
    _sum: {
      targetCount: true,
      successCount: true,
      failureCount: true
    },
    _count: true
  });

  return NextResponse.json({
    totalNotifications: stats._count,
    totalTargeted: stats._sum.targetCount || 0,
    totalSent: stats._sum.successCount || 0,
    totalFailed: stats._sum.failureCount || 0,
    successRate: stats._sum.targetCount ? 
      ((stats._sum.successCount || 0) / stats._sum.targetCount * 100).toFixed(2) + '%' : '0%',
    byType,
    period: { startDate, endDate }
  });
}

async function getCampaignStats(startDate?: string, endDate?: string, limit = 50) {
  const dateFilter: any = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  const campaigns = await prisma.notificationLog.groupBy({
    by: ['campaignId'],
    where: {
      campaignId: { not: null },
      ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {})
    },
    _sum: {
      targetCount: true,
      successCount: true,
      failureCount: true
    },
    _count: true,
    orderBy: {
      _count: {
        campaignId: 'desc'
      }
    },
    take: limit
  });

  return NextResponse.json({ campaigns });
}

async function getAudienceStatistics() {
  // Use the fcm-service to get accurate user stats
  const [usersWithTokensData, totalUsers, platformStats, recentActivity] = await Promise.all([
    // Get users with tokens using the service
    getUsersWithFcmTokens(),
    
    // Get total users count
    prisma.user.count(),
    
    // Get platform breakdown
    prisma.fcmToken.groupBy({
      by: ['platform'],
      where: { isActive: true },
      _count: { platform: true }
    }),
    
    // Get recent activity
    prisma.notificationLog.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    })
  ]);

  const usersWithTokens = usersWithTokensData.length;
  const totalTokens = usersWithTokensData.reduce((sum, user) => sum + user.tokens.length, 0);
  
  const deviceStats = platformStats.reduce((acc: Record<string, number>, stat) => {
    acc[stat.platform || 'unknown'] = stat._count.platform;
    return acc;
  }, {});

  return NextResponse.json({
    totalUsers,
    usersWithTokens,
    usersWithoutTokens: totalUsers - usersWithTokens,
    totalTokens,
    averageTokensPerUser: usersWithTokens > 0 ? (totalTokens / usersWithTokens).toFixed(2) : '0',
    tokenCoverage: totalUsers > 0 ? 
      (usersWithTokens / totalUsers * 100).toFixed(2) + '%' : '0%',
    devicePlatforms: deviceStats,
    recentActivity24h: recentActivity
  });
}

async function getRecentNotificationLogs(limit = 50) {
  const logs = await prisma.notificationLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      requestId: true,
      type: true,
      title: true,
      audience: true,
      targetCount: true,
      successCount: true,
      failureCount: true,
      campaignId: true,
      priority: true,
      dryRun: true,
      createdAt: true,
      user: {
        select: {
          email: true,
          name: true
        }
      }
    }
  });

  return NextResponse.json({ logs });
}

async function getPerformanceMetrics(startDate?: string, endDate?: string) {
  const dateFilter: any = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  // Get average response times and success rates
  const metrics = await prisma.$queryRaw`
    SELECT 
      DATE(createdAt) as date,
      AVG(JSON_EXTRACT(metadata, '$.responseTime')) as avg_response_time,
      AVG(successCount * 100.0 / NULLIF(targetCount, 0)) as avg_success_rate,
      COUNT(*) as total_notifications
    FROM NotificationLog 
    ${dateFilter.gte || dateFilter.lte ? `WHERE createdAt >= ? AND createdAt <= ?` : ''}
    GROUP BY DATE(createdAt)
    ORDER BY date DESC
    LIMIT 30
  `;

  return NextResponse.json({ 
    performanceMetrics: metrics,
    period: { startDate, endDate }
  });
}

async function getUsersWithTokens(limit = 100) {
  // Use the existing service function
  const usersWithTokens = await getUsersWithFcmTokens();
  
  // Format for frontend (limit results and add required fields)
  const formattedUsers = usersWithTokens.slice(0, limit).map(user => ({
    userId: user.id,
    email: user.email || '',
    name: user.name || user.email || 'Unknown User',
    hasToken: user.hasToken,
    deviceCount: user.deviceCount,
    tokenCount: user.tokens.length,
    tokenPreview: user.tokenPreview,
    categories: user.categories.join(', ')
  }));
  
  return NextResponse.json({
    success: true,
    users: formattedUsers,
    totalUsers: formattedUsers.length,
    totalTokens: usersWithTokens.reduce((sum, user) => sum + user.tokens.length, 0)
  });
}