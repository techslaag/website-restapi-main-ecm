import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/middleware/auth";
import { notificationLogger } from "@/lib/utils/logging";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const granularity = searchParams.get('granularity') || 'day'; // day, hour, week, month
    const limit = parseInt(searchParams.get('limit') || '100');

    // Authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const dateFilter = buildDateFilter(startDate || undefined, endDate || undefined);

    switch (action) {
      case 'overview':
        return await getAnalyticsOverview(dateFilter);
      
      case 'trends':
        return await getNotificationTrends(dateFilter, granularity);
      
      case 'performance':
        return await getPerformanceAnalytics(dateFilter);
      
      case 'audience':
        return await getAudienceAnalytics(dateFilter);
      
      case 'campaigns':
        return await getCampaignAnalytics(dateFilter, limit);
      
      case 'templates':
        return await getTemplateAnalytics(dateFilter, limit);
      
      case 'errors':
        return await getErrorAnalytics(dateFilter, limit);
      
      case 'real-time':
        return await getRealTimeStats();
      
      case 'export':
        return await exportAnalyticsData(dateFilter, searchParams.get('format') || 'json');

      default:
        return NextResponse.json({
          message: "Notification Analytics API",
          version: "2.0.0",
          endpoints: {
            "GET /api/notifications/analytics?action=overview": "Get analytics overview",
            "GET /api/notifications/analytics?action=trends": "Get notification trends",
            "GET /api/notifications/analytics?action=performance": "Get performance metrics",
            "GET /api/notifications/analytics?action=audience": "Get audience insights",
            "GET /api/notifications/analytics?action=campaigns": "Get campaign analytics",
            "GET /api/notifications/analytics?action=templates": "Get template performance",
            "GET /api/notifications/analytics?action=errors": "Get error analytics",
            "GET /api/notifications/analytics?action=real-time": "Get real-time statistics",
            "GET /api/notifications/analytics?action=export": "Export analytics data"
          }
        });
    }

  } catch (error) {
    await notificationLogger.error("Analytics API error", {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function getAnalyticsOverview(dateFilter: any) {
  try {
    // Basic metrics
    const totalNotifications = await prisma.notificationLog.count({
      where: dateFilter
    });

  const aggregates = await prisma.notificationLog.aggregate({
    where: dateFilter,
    _sum: {
      targetCount: true,
      successCount: true,
      failureCount: true
    },
    _avg: {
      successCount: true,
      failureCount: true
    }
  });

  // Growth metrics (compare with previous period)
  const prevPeriodFilter = buildPreviousPeriodFilter(dateFilter);
  const prevTotalNotifications = await prisma.notificationLog.count({
    where: prevPeriodFilter
  });

  const prevAggregates = await prisma.notificationLog.aggregate({
    where: prevPeriodFilter,
    _sum: {
      targetCount: true,
      successCount: true,
      failureCount: true
    }
  });

  // Top performing campaigns
  const topCampaigns = await prisma.notificationLog.groupBy({
    by: ['campaignId'],
    where: {
      ...dateFilter,
      campaignId: { not: null }
    },
    _sum: {
      successCount: true,
      targetCount: true
    },
    orderBy: {
      _sum: {
        successCount: 'desc'
      }
    },
    take: 5
  });

  // Audience breakdown
  const audienceBreakdown = await prisma.notificationLog.groupBy({
    by: ['audience'],
    where: dateFilter,
    _count: true,
    _sum: {
      successCount: true,
      targetCount: true
    }
  });

  const totalTargeted = aggregates._sum.targetCount || 0;
  const totalSent = aggregates._sum.successCount || 0;
  const totalFailed = aggregates._sum.failureCount || 0;

    return NextResponse.json({
      overview: {
        totalNotifications,
        totalTargeted,
        totalSent,
        totalFailed,
        successRate: totalTargeted > 0 ? 
          ((totalSent / totalTargeted) * 100).toFixed(2) + '%' : '0%',
        averageSuccessPerNotification: aggregates._avg.successCount?.toFixed(1) || '0',
        averageFailurePerNotification: aggregates._avg.failureCount?.toFixed(1) || '0'
      },
      growth: {
        notificationsGrowth: calculateGrowthRate(totalNotifications, prevTotalNotifications),
        targetedGrowth: calculateGrowthRate(
          aggregates._sum.targetCount || 0, 
          prevAggregates._sum.targetCount || 0
        ),
        sentGrowth: calculateGrowthRate(
          aggregates._sum.successCount || 0, 
          prevAggregates._sum.successCount || 0
        )
      },
      topCampaigns,
      audienceBreakdown,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    // Return mock data if tables don't exist yet
    console.log("Analytics overview error (using mock data):", error);
    return NextResponse.json({
      overview: {
        totalNotifications: 0,
        totalTargeted: 0,
        totalSent: 0,
        totalFailed: 0,
        successRate: '0%',
        averageSuccessPerNotification: '0',
        averageFailurePerNotification: '0'
      },
      growth: {
        notificationsGrowth: '0%',
        targetedGrowth: '0%',
        sentGrowth: '0%'
      },
      topCampaigns: [],
      audienceBreakdown: [],
      generatedAt: new Date().toISOString(),
      mockData: true
    });
  }
}

async function getNotificationTrends(dateFilter: any, granularity: string) {
  let groupByClause: string;

  switch (granularity) {
    case 'hour':
      groupByClause = 'DATE_FORMAT(createdAt, "%Y-%m-%d %H:00:00")';
      break;
    case 'week':
      groupByClause = 'DATE_FORMAT(createdAt, "%Y-%u")';
      break;
    case 'month':
      groupByClause = 'DATE_FORMAT(createdAt, "%Y-%m")';
      break;
    default: // day
      groupByClause = 'DATE(createdAt)';
  }

  const trends = await prisma.$queryRaw`
    SELECT 
      ${groupByClause} as period,
      COUNT(*) as notificationCount,
      SUM(targetCount) as totalTargeted,
      SUM(successCount) as totalSent,
      SUM(failureCount) as totalFailed,
      AVG(successCount * 100.0 / NULLIF(targetCount, 0)) as avgSuccessRate,
      AVG(JSON_EXTRACT(metadata, '$.responseTime')) as avgResponseTime
    FROM NotificationLog 
    WHERE ${dateFilter ? 'createdAt >= ? AND createdAt <= ?' : '1=1'}
    GROUP BY ${groupByClause}
    ORDER BY period ASC
    LIMIT 100
  `;

  return NextResponse.json({
    trends,
    granularity,
    period: dateFilter
  });
}

async function getPerformanceAnalytics(dateFilter: any) {
  // Response time distribution
  const responseTimeStats = await prisma.$queryRaw`
    SELECT 
      MIN(JSON_EXTRACT(metadata, '$.responseTime')) as minResponseTime,
      MAX(JSON_EXTRACT(metadata, '$.responseTime')) as maxResponseTime,
      AVG(JSON_EXTRACT(metadata, '$.responseTime')) as avgResponseTime,
      STDDEV(JSON_EXTRACT(metadata, '$.responseTime')) as stdDevResponseTime
    FROM NotificationLog 
    WHERE ${dateFilter ? 'createdAt >= ? AND createdAt <= ?' : '1=1'}
    AND JSON_EXTRACT(metadata, '$.responseTime') IS NOT NULL
  `;

  // Success rate by notification type
  const successRateByType = await prisma.notificationLog.groupBy({
    by: ['type'],
    where: dateFilter,
    _sum: {
      targetCount: true,
      successCount: true,
      failureCount: true
    },
    _count: true
  });

  // Peak usage hours
  const peakHours = await prisma.$queryRaw`
    SELECT 
      HOUR(createdAt) as hour,
      COUNT(*) as notificationCount,
      AVG(successCount * 100.0 / NULLIF(targetCount, 0)) as avgSuccessRate
    FROM NotificationLog 
    WHERE ${dateFilter ? 'createdAt >= ? AND createdAt <= ?' : '1=1'}
    GROUP BY HOUR(createdAt)
    ORDER BY notificationCount DESC
    LIMIT 24
  `;

  // Batch size analysis
  const batchSizeStats = await prisma.$queryRaw`
    SELECT 
      CASE 
        WHEN targetCount <= 10 THEN '1-10'
        WHEN targetCount <= 100 THEN '11-100'
        WHEN targetCount <= 1000 THEN '101-1000'
        WHEN targetCount <= 10000 THEN '1001-10000'
        ELSE '10000+'
      END as batchSize,
      COUNT(*) as count,
      AVG(successCount * 100.0 / NULLIF(targetCount, 0)) as avgSuccessRate,
      AVG(JSON_EXTRACT(metadata, '$.responseTime')) as avgResponseTime
    FROM NotificationLog 
    WHERE ${dateFilter ? 'createdAt >= ? AND createdAt <= ?' : '1=1'}
    GROUP BY batchSize
    ORDER BY count DESC
  `;

  return NextResponse.json({
    responseTimeStats: (responseTimeStats as any[])[0],
    successRateByType: successRateByType.map(item => ({
      type: item.type,
      count: item._count,
      successRate: (item._sum.targetCount || 0) > 0 ? 
        (((item._sum.successCount || 0) / (item._sum.targetCount || 1)) * 100).toFixed(2) + '%' : '0%',
      totalTargeted: item._sum.targetCount || 0,
      totalSent: item._sum.successCount || 0,
      totalFailed: item._sum.failureCount || 0
    })),
    peakHours,
    batchSizeStats
  });
}

async function getAudienceAnalytics(dateFilter: any) {
  // Audience engagement by segment
  const audienceEngagement = await prisma.notificationLog.groupBy({
    by: ['audience'],
    where: dateFilter,
    _sum: {
      targetCount: true,
      successCount: true,
      failureCount: true
    },
    _count: true
  });

  // Token health analysis (commented out unused variable)
  // const tokenHealth = await prisma.preference.groupBy({
  //   by: ['fcmToken'],
  //   where: {
  //     fcmToken: { not: null }
  //   },
  //   _count: true
  // });

  const totalTokens = await prisma.preference.count({
    where: { fcmToken: { not: null } }
  });

  const activeTokens = await prisma.notificationLog.count({
    where: {
      ...dateFilter,
      successCount: { gt: 0 }
    }
  });

  // Geographic distribution (if available)
  const geoDistribution = await prisma.$queryRaw`
    SELECT 
      JSON_EXTRACT(metadata, '$.country') as country,
      COUNT(*) as notificationCount,
      SUM(successCount) as totalSent
    FROM NotificationLog 
    WHERE ${dateFilter ? 'createdAt >= ? AND createdAt <= ?' : '1=1'}
    AND JSON_EXTRACT(metadata, '$.country') IS NOT NULL
    GROUP BY country
    ORDER BY notificationCount DESC
    LIMIT 20
  `;

  return NextResponse.json({
    audienceEngagement: audienceEngagement.map(item => ({
      audience: item.audience,
      notifications: item._count,
      totalTargeted: item._sum.targetCount,
      totalSent: item._sum.successCount,
      engagementRate: (item._sum.targetCount || 0) > 0 ? 
        (((item._sum.successCount || 0) / (item._sum.targetCount || 1)) * 100).toFixed(2) + '%' : '0%'
    })),
    tokenHealth: {
      totalTokens,
      activeTokens,
      tokenUtilizationRate: totalTokens > 0 ? 
        ((activeTokens / totalTokens) * 100).toFixed(2) + '%' : '0%'
    },
    geoDistribution
  });
}

async function getCampaignAnalytics(dateFilter: any, limit: number) {
  const campaigns = await prisma.notificationLog.groupBy({
    by: ['campaignId'],
    where: {
      ...dateFilter,
      campaignId: { not: null }
    },
    _sum: {
      targetCount: true,
      successCount: true,
      failureCount: true
    },
    _count: true,
    _min: {
      createdAt: true
    },
    _max: {
      createdAt: true
    },
    orderBy: {
      _sum: {
        successCount: 'desc'
      }
    },
    take: limit
  });

  return NextResponse.json({
    campaigns: campaigns.map(campaign => ({
      campaignId: campaign.campaignId,
      notifications: campaign._count,
      totalTargeted: campaign._sum.targetCount,
      totalSent: campaign._sum.successCount,
      totalFailed: campaign._sum.failureCount,
      successRate: (campaign._sum.targetCount || 0) > 0 ? 
        (((campaign._sum.successCount || 0) / (campaign._sum.targetCount || 1)) * 100).toFixed(2) + '%' : '0%',
      duration: campaign._min.createdAt && campaign._max.createdAt ? 
        Math.ceil((campaign._max.createdAt.getTime() - campaign._min.createdAt.getTime()) / (1000 * 60 * 60 * 24)) + ' days' : 'N/A'
    }))
  });
}

async function getTemplateAnalytics(dateFilter: any, limit: number) {
  const templates = await prisma.notificationLog.groupBy({
    by: ['templateId'],
    where: {
      ...dateFilter,
      templateId: { not: null }
    },
    _sum: {
      targetCount: true,
      successCount: true,
      failureCount: true
    },
    _count: true,
    orderBy: {
      _count: {
        templateId: 'desc'
      }
    },
    take: limit
  });

  // Template details would come from a notificationTemplate model if it existed
  const templateDetails: any[] = [];

  return NextResponse.json({
    templates: templates.map(template => {
      const details = templateDetails.find((t: any) => t.id === template.templateId);
      return {
        templateId: template.templateId,
        templateName: details?.name || 'Unknown Template',
        category: details?.category || 'Unknown',
        usageCount: template._count,
        totalTargeted: template._sum.targetCount,
        totalSent: template._sum.successCount,
        totalFailed: template._sum.failureCount,
        successRate: (template._sum.targetCount || 0) > 0 ? 
          (((template._sum.successCount || 0) / (template._sum.targetCount || 1)) * 100).toFixed(2) + '%' : '0%'
      };
    })
  });
}

async function getErrorAnalytics(dateFilter: any, limit: number) {
  // Using NotificationLog for error analysis since NotificationActivityLog doesn't exist
  const errorLogs = await prisma.notificationLog.findMany({
    where: {
      ...dateFilter,
      failureCount: { gt: 0 }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: limit,
    select: {
      requestId: true,
      type: true,
      title: true,
      failureCount: true,
      metadata: true,
      createdAt: true
    }
  });

  // Error frequency analysis based on failure counts
  const errorFrequency = await prisma.notificationLog.groupBy({
    by: ['type'],
    where: {
      ...dateFilter,
      failureCount: { gt: 0 }
    },
    _count: true,
    _sum: {
      failureCount: true
    },
    orderBy: {
      _sum: {
        failureCount: 'desc'
      }
    },
    take: 10
  });

  return NextResponse.json({
    recentErrors: errorLogs,
    errorFrequency: errorFrequency.map((item: any) => ({
      type: item.type,
      count: item._count,
      totalFailures: item._sum.failureCount || 0,
      percentage: errorLogs.length > 0 ? 
        ((item._count / errorLogs.length) * 100).toFixed(2) + '%' : '0%'
    })),
    totalErrors: errorLogs.length
  });
}

async function getRealTimeStats() {
  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);

    const [last24hStats, lastHourStats, activeScheduled] = await Promise.all([
      prisma.notificationLog.aggregate({
        where: { createdAt: { gte: last24Hours } },
        _sum: { targetCount: true, successCount: true, failureCount: true },
        _count: true
      }),
      prisma.notificationLog.aggregate({
        where: { createdAt: { gte: lastHour } },
        _sum: { targetCount: true, successCount: true, failureCount: true },
        _count: true
      }),
      prisma.scheduledNotification.count({
        where: { 
          status: 'scheduled',
          scheduledAt: {
            gte: new Date(),
            lte: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    return NextResponse.json({
      last24Hours: {
        notifications: last24hStats._count,
        targeted: last24hStats._sum.targetCount || 0,
        sent: last24hStats._sum.successCount || 0,
        failed: last24hStats._sum.failureCount || 0
      },
      lastHour: {
        notifications: lastHourStats._count,
        targeted: lastHourStats._sum.targetCount || 0,
        sent: lastHourStats._sum.successCount || 0,
        failed: lastHourStats._sum.failureCount || 0
      },
      upcoming: {
        scheduledNext24Hours: activeScheduled
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.log("Real-time stats error (using mock data):", error);
    return NextResponse.json({
      last24Hours: {
        notifications: 0,
        targeted: 0,
        sent: 0,
        failed: 0
      },
      lastHour: {
        notifications: 0,
        targeted: 0,
        sent: 0,
        failed: 0
      },
      upcoming: {
        scheduledNext24Hours: 0
      },
      timestamp: new Date().toISOString(),
      mockData: true
    });
  }
}

async function exportAnalyticsData(dateFilter: any, format: string) {
  const data = await prisma.notificationLog.findMany({
    where: dateFilter,
    orderBy: { createdAt: 'desc' },
    take: 10000, // Limit for performance
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

  if (format === 'csv') {
    const csv = convertToCSV(data);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="notification-analytics.csv"'
      }
    });
  }

  return NextResponse.json({
    data,
    totalRecords: data.length,
    exportedAt: new Date().toISOString()
  });
}

// Helper functions

function buildDateFilter(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return undefined;
  
  const filter: any = {};
  if (startDate) filter.gte = new Date(startDate);
  if (endDate) filter.lte = new Date(endDate);
  
  return { createdAt: filter };
}

function buildPreviousPeriodFilter(currentFilter: any) {
  if (!currentFilter?.createdAt) return undefined;

  const start = currentFilter.createdAt.gte;
  const end = currentFilter.createdAt.lte;
  
  if (!start || !end) return undefined;

  const duration = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - duration);
  const prevEnd = new Date(start.getTime());

  return {
    createdAt: {
      gte: prevStart,
      lte: prevEnd
    }
  };
}

function calculateGrowthRate(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+∞%' : '0%';
  const growth = ((current - previous) / previous) * 100;
  return (growth >= 0 ? '+' : '') + growth.toFixed(1) + '%';
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => 
    Object.values(row).map(value => 
      typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
    ).join(',')
  );

  return [headers, ...rows].join('\n');
}