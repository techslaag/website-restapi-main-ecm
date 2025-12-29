import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";

export const dynamic = "force-dynamic";

// Function to detect device type from user agent
function detectDeviceType(userAgent: string | null): string {
  if (!userAgent) return 'unknown';
  
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone') || ua.includes('ipod')) {
    return 'mobile';
  } else if (ua.includes('ipad') || ua.includes('tablet')) {
    return 'tablet';
  } else if (ua.includes('smart-tv') || ua.includes('smarttv') || ua.includes('tv')) {
    return 'tv';
  } else {
    return 'desktop';
  }
}

// Get device statistics with filters
export async function GET(req: Request) {
  try {
    const queryParams = extractQueryParams(req);
    const { 
      ad_id,
      start_date, 
      end_date,
      position,
      include_performance = "true", // Include performance metrics per device
      device_type // Filter by device type
    } = queryParams;

    // Build date filter
    let dateFilter: any = {};
    const now = new Date();
    
    if (start_date || end_date) {
      dateFilter.timestamp = {};
      if (start_date) {
        const startDateObj = new Date(start_date);
        dateFilter.timestamp.gte = startDateObj > now ? now : startDateObj;
      }
      if (end_date) {
        const endDateObj = new Date(end_date);
        dateFilter.timestamp.lte = endDateObj > now ? now : endDateObj;
      }
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter.timestamp = { 
        gte: thirtyDaysAgo,
        lte: now 
      };
    }

    // Build where clause
    let whereClause: any = { 
      ...dateFilter
    };
    
    if (ad_id) {
      whereClause.ad_id = BigInt(ad_id);
    }
    
    // Handle position filter using posts with meta relation pattern
    if (position) {
      const adsWithPosition = await prisma.mod180_posts.findMany({
        where: {
          post_type: "advertising",
          post_status: "publish",
          meta: {
            some: {
              meta_key: "position",
              meta_value: position
            }
          }
        },
        select: {
          ID: true
        }
      });
      
      if (adsWithPosition.length > 0) {
        const adIds = adsWithPosition.map(post => post.ID);
        whereClause.ad_id = {
          in: adIds
        };
      } else {
        // No ads found with this position, return empty results
        whereClause.ad_id = BigInt(-1); // Non-existent ID
      }
    }

    // Get all insights and process device types manually
    const allInsights = await prisma.ad_insights.findMany({
      where: whereClause,
      select: {
        id: true,
        event_type: true,
        user_agent: true,
        user_ip: true,
        session_id: true
      }
    });

    // Process device statistics manually
    const deviceCounts: Record<string, number> = {};
    const devicePerformanceData: Record<string, Record<string, number>> = {};
    const uniqueSessionsByDevice: Record<string, Set<string>> = {};

    allInsights.forEach(insight => {
      const deviceType = detectDeviceType(insight.user_agent);
      
      // Filter by device type if specified
      if (device_type && device_type !== '' && deviceType !== device_type) {
        return;
      }

      // Count total events by device
      deviceCounts[deviceType] = (deviceCounts[deviceType] || 0) + 1;

      // Track performance metrics
      if (!devicePerformanceData[deviceType]) {
        devicePerformanceData[deviceType] = {
          impressions: 0,
          clicks: 0,
          views: 0,
          hovers: 0
        };
      }
      devicePerformanceData[deviceType][insight.event_type + 's'] = 
        (devicePerformanceData[deviceType][insight.event_type + 's'] || 0) + 1;

      // Track unique sessions (as a proxy for unique visitors)
      if (!uniqueSessionsByDevice[deviceType]) {
        uniqueSessionsByDevice[deviceType] = new Set();
      }
      if (insight.session_id) {
        uniqueSessionsByDevice[deviceType].add(insight.session_id);
      } else if (insight.user_ip) {
        // Fallback to IP if no session_id
        uniqueSessionsByDevice[deviceType].add(insight.user_ip);
      }
    });

    // Calculate total events
    const totalEvents = Object.values(deviceCounts).reduce((sum, count) => sum + count, 0);

    // Format device distribution
    const deviceDistribution = Object.entries(deviceCounts)
      .map(([deviceType, count]) => ({
        device_type: deviceType,
        count,
        percentage: totalEvents > 0 
          ? Number((count / totalEvents * 100).toFixed(2))
          : 0,
        unique_visitors: uniqueSessionsByDevice[deviceType]?.size || 0
      }))
      .sort((a, b) => b.count - a.count);

    // Format performance data if requested
    let devicePerformance = null;
    if (include_performance === "true") {
      devicePerformance = Object.entries(devicePerformanceData)
        .map(([deviceType, metrics]) => {
          const impressions = metrics.impressions || 0;
          const clicks = metrics.clicks || 0;
          const views = metrics.views || 0;
          const hovers = metrics.hovers || 0;
          
          return {
            device_type: deviceType,
            impressions,
            clicks,
            views,
            hovers,
            unique_visitors: uniqueSessionsByDevice[deviceType]?.size || 0,
            ctr: impressions > 0
              ? Number((clicks / impressions * 100).toFixed(2))
              : 0,
            engagement_rate: impressions > 0
              ? Number(((clicks + views + hovers) / impressions * 100).toFixed(2))
              : 0
          };
        })
        .sort((a, b) => b.impressions - a.impressions);
    }

    // Calculate summary statistics
    const summary = {
      total_devices: deviceDistribution.length,
      total_events: totalEvents,
      dominant_device: deviceDistribution[0]?.device_type || 'none',
      dominant_device_share: deviceDistribution[0]?.percentage || 0,
      mobile_percentage: deviceDistribution.find(d => d.device_type === 'mobile')?.percentage || 0,
      desktop_percentage: deviceDistribution.find(d => d.device_type === 'desktop')?.percentage || 0,
      tablet_percentage: deviceDistribution.find(d => d.device_type === 'tablet')?.percentage || 0,
      total_unique_visitors: Object.values(uniqueSessionsByDevice).reduce((sum, sessions) => sum + sessions.size, 0)
    };

    const response = {
      data: {
        distribution: deviceDistribution,
        performance: devicePerformance
      },
      summary,
      filters: {
        start_date: dateFilter.timestamp?.gte?.toISOString().split('T')[0],
        end_date: dateFilter.timestamp?.lte?.toISOString().split('T')[0],
        ad_id,
        position,
        device_type,
        include_performance
      },
      chart_data: {
        labels: deviceDistribution.map(d => 
          d.device_type.charAt(0).toUpperCase() + d.device_type.slice(1)
        ),
        datasets: [{
          data: deviceDistribution.map(d => d.count),
          backgroundColor: deviceDistribution.map(d => {
            const colors: Record<string, string> = {
              'desktop': '#2271b1',
              'mobile': '#4ab866',
              'tablet': '#f0b849',
              'tv': '#d63638',
              'unknown': '#666666'
            };
            return colors[d.device_type] || colors['unknown'];
          })
        }]
      }
    };

    return Response.json(toSafeJSON(response), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error("Device stats error:", error);
    return Response.json({ 
      success: false,
      error: 'Failed to fetch device statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}