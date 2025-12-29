import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/middleware/auth";
import { notificationLogger } from "@/lib/utils/logging";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const status = searchParams.get('status');
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
      case 'scheduled':
        return await getScheduledNotifications(status || undefined, limit);
      
      case 'process':
        return await processScheduledNotifications();
      
      case 'stats':
        return await getSchedulerStats();

      default:
        return NextResponse.json({
          message: "Notification Scheduler API",
          endpoints: {
            "GET /api/notifications/scheduler?action=scheduled": "Get scheduled notifications",
            "GET /api/notifications/scheduler?action=process": "Process due notifications",
            "GET /api/notifications/scheduler?action=stats": "Get scheduler statistics",
            "POST /api/notifications/scheduler": "Schedule a notification",
            "PUT /api/notifications/scheduler": "Update scheduled notification",
            "DELETE /api/notifications/scheduler?id=<id>": "Cancel scheduled notification"
          }
        });
    }

  } catch (error) {
    await notificationLogger.error("Scheduler API error", {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const {
      type,
      title,
      body,
      audience,
      targetUserId,
      testFcmToken,
      data,
      segmentCriteria,
      priority = 'normal',
      templateId,
      campaignId,
      scheduledAt,
      timezone = 'UTC',
      recurrence, // 'none', 'daily', 'weekly', 'monthly'
      recurrenceEnd,
      maxRetries = 3
    } = await request.json();

    // Validation
    const validation = validateScheduleRequest({
      type, title, body, audience, scheduledAt, timezone
    });

    if (!validation.isValid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      );
    }

    const scheduledAtDate = new Date(scheduledAt);
    const now = new Date();

    if (scheduledAtDate <= now) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 }
      );
    }

    // Create scheduled notification
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const scheduledNotification = await prisma.scheduledNotification.create({
      data: {
        requestId,
        type,
        title,
        body,
        audience,
        targetUserId,
        customFcmToken: testFcmToken,
        data: JSON.stringify(data || {}),
        segmentCriteria: JSON.stringify(segmentCriteria || {}),
        priority,
        templateId,
        campaignId,
        scheduledAt: scheduledAtDate,
        timezone,
        recurrence: recurrence || 'none',
        recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null,
        maxRetries,
        userId: authResult.user.id,
        status: 'scheduled'
      }
    });

    await notificationLogger.info("Notification scheduled", {
      scheduledNotificationId: scheduledNotification.id,
      scheduledAt: scheduledAtDate,
      audience,
      type
    }, authResult.user.id);

    return NextResponse.json({
      success: true,
      scheduledNotification,
      message: "Notification scheduled successfully"
    });

  } catch (error) {
    await notificationLogger.error("Error scheduling notification", {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const {
      id,
      scheduledAt,
      status,
      title,
      body,
      priority,
      maxRetries
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Scheduled notification ID is required" },
        { status: 400 }
      );
    }

    // Check if notification exists and can be modified
    const existing = await prisma.scheduledNotification.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Scheduled notification not found" },
        { status: 404 }
      );
    }

    if (existing.status === 'sent' || existing.status === 'failed') {
      return NextResponse.json(
        { error: "Cannot modify completed notifications" },
        { status: 400 }
      );
    }

    const updateData: any = {
      updatedAt: new Date()
    };

    if (scheduledAt) {
      const scheduledAtDate = new Date(scheduledAt);
      if (scheduledAtDate <= new Date()) {
        return NextResponse.json(
          { error: "Scheduled time must be in the future" },
          { status: 400 }
        );
      }
      updateData.scheduledAt = scheduledAtDate;
    }

    if (status) updateData.status = status;
    if (title) updateData.title = title;
    if (body) updateData.body = body;
    if (priority) updateData.priority = priority;
    if (maxRetries !== undefined) updateData.maxRetries = maxRetries;

    const updated = await prisma.scheduledNotification.update({
      where: { id },
      data: updateData
    });

    await notificationLogger.info("Scheduled notification updated", {
      scheduledNotificationId: id,
      changes: Object.keys(updateData)
    }, authResult.user.id);

    return NextResponse.json({
      success: true,
      scheduledNotification: updated
    });

  } catch (error) {
    await notificationLogger.error("Error updating scheduled notification", {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: "Scheduled notification ID is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.scheduledNotification.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Scheduled notification not found" },
        { status: 404 }
      );
    }

    if (existing.status === 'sent') {
      return NextResponse.json(
        { error: "Cannot cancel sent notifications" },
        { status: 400 }
      );
    }

    await prisma.scheduledNotification.update({
      where: { id },
      data: {
        status: 'cancelled',
        updatedAt: new Date()
      }
    });

    await notificationLogger.info("Scheduled notification cancelled", {
      scheduledNotificationId: id
    }, authResult.user.id);

    return NextResponse.json({
      success: true,
      message: "Notification cancelled"
    });

  } catch (error) {
    await notificationLogger.error("Error cancelling scheduled notification", {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper functions

async function getScheduledNotifications(status?: string, limit = 50) {
  try {
    const where: any = {};
    if (status) where.status = status;

    const notifications = await prisma.scheduledNotification.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      take: limit,
      include: {
        user: {
          select: {
            email: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json({
      scheduledNotifications: notifications,
      total: notifications.length
    });
  } catch (error) {
    console.log("Scheduled notifications error (using mock data):", error);
    return NextResponse.json({
      scheduledNotifications: [],
      total: 0,
      mockData: true
    });
  }
}

async function processScheduledNotifications() {
  const now = new Date();
  
  // Get notifications that are due
  const dueNotifications = await prisma.scheduledNotification.findMany({
    where: {
      scheduledAt: { lte: now },
      status: 'scheduled'
    },
    take: 100 // Process in batches
  });

  const results = {
    processed: 0,
    failed: 0,
    details: []
  };

  for (const notification of dueNotifications) {
    try {
      // Mark as processing
      await prisma.scheduledNotification.update({
        where: { id: notification.id },
        data: { status: 'processing' }
      });

      // Process the notification
      const processResult = await processNotification(notification);
      
      if (processResult.success) {
        // Mark as sent
        await prisma.scheduledNotification.update({
          where: { id: notification.id },
          data: { 
            status: 'sent',
            sentAt: new Date(),
            result: JSON.stringify(processResult)
          }
        });

        // Handle recurrence
        if (notification.recurrence !== 'none') {
          await createRecurringNotification(notification);
        }

        results.processed++;
      } else {
        // Handle failure
        const retryCount = notification.retryCount + 1;
        
        if (retryCount >= notification.maxRetries) {
          // Max retries reached, mark as failed
          await prisma.scheduledNotification.update({
            where: { id: notification.id },
            data: { 
              status: 'failed',
              retryCount,
              lastError: processResult.error,
              failedAt: new Date()
            }
          });
        } else {
          // Schedule retry
          const retryDelay = Math.pow(2, retryCount) * 60 * 1000; // Exponential backoff
          await prisma.scheduledNotification.update({
            where: { id: notification.id },
            data: { 
              status: 'scheduled',
              retryCount,
              scheduledAt: new Date(Date.now() + retryDelay),
              lastError: processResult.error
            }
          });
        }

        results.failed++;
      }

      (results.details as any[]).push({
        id: notification.id,
        success: processResult.success,
        error: processResult.error
      });

    } catch (error) {
      console.error(`Failed to process notification ${notification.id}:`, error);
      results.failed++;
    }
  }

  await notificationLogger.info("Scheduled notifications processed", {
    totalDue: dueNotifications.length,
    processed: results.processed,
    failed: results.failed
  });

  return NextResponse.json({
    success: true,
    results
  });
}

async function processNotification(notification: any): Promise<{ success: boolean; error?: string }> {
  try {
    // Call the main notification API
    const response = await fetch(`${process.env.API_BASE_URL}/api/notifications/firebase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Scheduled-Notification': notification.id
      },
      body: JSON.stringify({
        type: notification.type,
        title: notification.title,
        body: notification.body,
        audience: notification.audience,
        targetUserId: notification.targetUserId,
        customFcmToken: notification.customFcmToken,
        data: JSON.parse(notification.data || '{}'),
        segmentCriteria: JSON.parse(notification.segmentCriteria || '{}'),
        priority: notification.priority,
        templateId: notification.templateId,
        campaignId: notification.campaignId
      })
    });

    if (response.ok) {
      return { success: true };
    } else {
      const errorData = await response.json();
      return { success: false, error: errorData.error || 'Unknown error' };
    }

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function createRecurringNotification(notification: any) {
  const nextScheduledAt = calculateNextOccurrence(
    notification.scheduledAt,
    notification.recurrence,
    notification.timezone
  );

  if (nextScheduledAt && (!notification.recurrenceEnd || nextScheduledAt <= notification.recurrenceEnd)) {
    await prisma.scheduledNotification.create({
      data: {
        requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        audience: notification.audience,
        targetUserId: notification.targetUserId,
        customFcmToken: notification.customFcmToken,
        data: notification.data,
        segmentCriteria: notification.segmentCriteria,
        priority: notification.priority,
        templateId: notification.templateId,
        campaignId: notification.campaignId,
        scheduledAt: nextScheduledAt,
        timezone: notification.timezone,
        recurrence: notification.recurrence,
        recurrenceEnd: notification.recurrenceEnd,
        maxRetries: notification.maxRetries,
        userId: notification.userId,
        status: 'scheduled',
        parentId: notification.id
      }
    });
  }
}

function calculateNextOccurrence(lastDate: Date, recurrence: string, timezone: string): Date | null {
  const date = new Date(lastDate);

  switch (recurrence) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    default:
      return null;
  }

  return date;
}

async function getSchedulerStats() {
  const stats = await prisma.scheduledNotification.groupBy({
    by: ['status'],
    _count: true
  });

  const recentActivity = await prisma.scheduledNotification.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    }
  });

  const upcomingCount = await prisma.scheduledNotification.count({
    where: {
      status: 'scheduled',
      scheduledAt: {
        gte: new Date(),
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
      }
    }
  });

  return NextResponse.json({
    statusBreakdown: stats,
    recentActivity24h: recentActivity,
    upcomingNext7Days: upcomingCount
  });
}

function validateScheduleRequest(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.type?.trim()) errors.push("Type is required");
  if (!data.title?.trim()) errors.push("Title is required");
  if (!data.body?.trim()) errors.push("Body is required");
  if (!data.audience?.trim()) errors.push("Audience is required");
  if (!data.scheduledAt) errors.push("Scheduled time is required");

  if (data.scheduledAt && isNaN(Date.parse(data.scheduledAt))) {
    errors.push("Invalid scheduled time format");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}