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

interface TimelineDataPoint {
  date: string;
  impressions: number;
  clicks: number;
  views: number;
  hovers: number;
  unique_visitors: number;
  ctr: number;
  engagement_rate: number;
}

export async function GET(req: Request) {
  try {
    const queryParams = extractQueryParams(req);
    const { 
      ad_id, 
      start_date, 
      end_date, 
      granularity = "day", // hour, day, week, month
      device_type,
      position,
      compare_period = "false",
      include_cumulative = "false"
    } = queryParams;

    // Validate granularity
    const validGranularities = ["hour", "day", "week", "month"];
    if (!validGranularities.includes(granularity)) {
      return Response.json(
        {
          error: "Invalid granularity. Must be one of: hour, day, week, month",
        },
        {
          status: 400,
        },
      );
    }

    // Build where clause
    let whereClause: any = {};
    
    if (ad_id) {
      whereClause.ad_id = BigInt(ad_id);
    }

    const now = new Date();
    let defaultEndDate = end_date ? new Date(end_date) : now;
    let defaultStartDate = start_date ? new Date(start_date) : new Date(
      defaultEndDate.getTime() - 30 * 24 * 60 * 60 * 1000 // 30 days ago
    );

    // Validate dates
    if (isNaN(defaultStartDate.getTime())) {
      return Response.json(
        { error: "Invalid start_date format" },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        }
      );
    }
    
    if (isNaN(defaultEndDate.getTime())) {
      return Response.json(
        { error: "Invalid end_date format" },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        }
      );
    }

    whereClause.timestamp = {
      gte: defaultStartDate,
      lte: defaultEndDate
    };
    
    // Add device type filter
    if (device_type) {
      whereClause.device_type = device_type;
    }
    
    // Add position filter by querying related ad post meta
    if (position) {
      // Get ad IDs that have the specified position
      const adsWithPosition = await prisma.mod180_postmeta.findMany({
        where: {
          meta_key: "position",
          meta_value: position
        },
        select: {
          post_id: true
        }
      });
      
      if (adsWithPosition.length > 0) {
        const adIds = adsWithPosition.map(meta => meta.post_id);
        if (ad_id) {
          // If specific ad_id is already filtered, ensure it has the position
          if (!adIds.includes(BigInt(ad_id))) {
            whereClause.ad_id = BigInt(-1); // Non-existent ID
          }
        } else {
          // Filter by all ads with this position
          whereClause.ad_id = {
            in: adIds
          };
        }
      } else {
        // No ads found with this position, return empty results
        whereClause.ad_id = BigInt(-1); // Non-existent ID
      }
    }

    // Fetch all insights for the period
    const insights = await prisma.ad_insights.findMany({
      where: whereClause,
      select: {
        event_type: true,
        timestamp: true,
        session_id: true,
        user_agent: true,
        ad_id: true
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    // Group data by time period
    const timelineData: Record<string, any> = {};
    
    insights.forEach(insight => {
      const date = new Date(insight.timestamp || new Date());
      let timeKey: string;
      
      if (granularity === "hour") {
        timeKey = `${date.toISOString().split('T')[0]} ${String(date.getHours()).padStart(2, '0')}:00`;
      } else if (granularity === "day") {
        timeKey = date.toISOString().split('T')[0];
      } else if (granularity === "week") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        timeKey = weekStart.toISOString().split('T')[0];
      } else { // month
        timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      if (!timelineData[timeKey]) {
        timelineData[timeKey] = {
          impressions: 0,
          clicks: 0,
          views: 0,
          hovers: 0,
          visitors: new Set(),
          devices: {
            mobile: 0,
            desktop: 0,
            tablet: 0,
            tv: 0
          }
        };
      }
      
      // Count events
      timelineData[timeKey][insight.event_type + 's']++;
      
      // Track unique visitors using session_id
      if (insight.session_id) {
        timelineData[timeKey].visitors.add(insight.session_id);
      }
      
      // Track device types
      const deviceType = detectDeviceType(insight.user_agent);
      if (timelineData[timeKey].devices[deviceType] !== undefined) {
        timelineData[timeKey].devices[deviceType]++;
      }
    });

    // Convert to array and calculate metrics
    const timeline: TimelineDataPoint[] = Object.entries(timelineData)
      .map(([date, data]) => {
        const impressions = data.impressions || 0;
        const clicks = data.clicks || 0;
        const views = data.views || 0;
        const hovers = data.hovers || 0;
        const uniqueVisitors = data.visitors.size;
        
        return {
          date,
          impressions,
          clicks,
          views,
          hovers,
          unique_visitors: uniqueVisitors,
          ctr: impressions > 0 ? Number((clicks / impressions * 100).toFixed(2)) : 0,
          engagement_rate: impressions > 0 
            ? Number(((clicks + views + hovers) / impressions * 100).toFixed(2)) 
            : 0,
          devices: data.devices
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate cumulative data if requested
    let cumulativeTimeline = null;
    if (include_cumulative === "true") {
      let cumImpressions = 0;
      let cumClicks = 0;
      let cumViews = 0;
      let cumHovers = 0;
      const cumVisitors = new Set<string>();
      
      cumulativeTimeline = timeline.map(point => {
        cumImpressions += point.impressions;
        cumClicks += point.clicks;
        cumViews += point.views;
        cumHovers += point.hovers;
        
        // Add visitors to cumulative set
        Object.values(timelineData).forEach(data => {
          data.visitors.forEach((v: string) => cumVisitors.add(v));
        });
        
        return {
          date: point.date,
          impressions: cumImpressions,
          clicks: cumClicks,
          views: cumViews,
          hovers: cumHovers,
          unique_visitors: cumVisitors.size,
          ctr: cumImpressions > 0 ? Number((cumClicks / cumImpressions * 100).toFixed(2)) : 0,
          engagement_rate: cumImpressions > 0 
            ? Number(((cumClicks + cumViews + cumHovers) / cumImpressions * 100).toFixed(2)) 
            : 0
        };
      });
    }

    // Calculate comparison data if requested
    let comparisonData = null;
    if (compare_period === "true") {
      const periodDuration = defaultEndDate.getTime() - defaultStartDate.getTime();
      const compareEndDate = new Date(defaultStartDate.getTime() - 1); // Day before current period
      const compareStartDate = new Date(compareEndDate.getTime() - periodDuration);
      
      const compareInsights = await prisma.ad_insights.findMany({
        where: {
          ...whereClause,
          timestamp: {
            gte: compareStartDate,
            lte: compareEndDate
          }
        }
      });

      const currentPeriodStats = {
        impressions: insights.filter(i => i.event_type === 'impression').length,
        clicks: insights.filter(i => i.event_type === 'click').length,
        views: insights.filter(i => i.event_type === 'view').length,
        unique_visitors: new Set(insights.map(i => i.session_id).filter(Boolean)).size
      };

      const previousPeriodStats = {
        impressions: compareInsights.filter(i => i.event_type === 'impression').length,
        clicks: compareInsights.filter(i => i.event_type === 'click').length,
        views: compareInsights.filter(i => i.event_type === 'view').length,
        unique_visitors: new Set(compareInsights.map(i => i.session_id).filter(Boolean)).size
      };

      comparisonData = {
        current_period: currentPeriodStats,
        previous_period: previousPeriodStats,
        changes: {
          impressions: previousPeriodStats.impressions > 0 
            ? Number(((currentPeriodStats.impressions - previousPeriodStats.impressions) / previousPeriodStats.impressions * 100).toFixed(2))
            : 100,
          clicks: previousPeriodStats.clicks > 0 
            ? Number(((currentPeriodStats.clicks - previousPeriodStats.clicks) / previousPeriodStats.clicks * 100).toFixed(2))
            : 100,
          views: previousPeriodStats.views > 0 
            ? Number(((currentPeriodStats.views - previousPeriodStats.views) / previousPeriodStats.views * 100).toFixed(2))
            : 100,
          unique_visitors: previousPeriodStats.unique_visitors > 0 
            ? Number(((currentPeriodStats.unique_visitors - previousPeriodStats.unique_visitors) / previousPeriodStats.unique_visitors * 100).toFixed(2))
            : 100
        }
      };
    }

    // Calculate peak performance times
    const peakPerformance = {
      highest_impressions: timeline.reduce((prev, curr) => 
        curr.impressions > prev.impressions ? curr : prev
      , timeline[0] || { date: '', impressions: 0 }),
      highest_clicks: timeline.reduce((prev, curr) => 
        curr.clicks > prev.clicks ? curr : prev
      , timeline[0] || { date: '', clicks: 0 }),
      highest_ctr: timeline.reduce((prev, curr) => 
        curr.ctr > prev.ctr ? curr : prev
      , timeline[0] || { date: '', ctr: 0 })
    };

    return Response.json({
      timeline: toSafeJSON(timeline),
      cumulative_timeline: toSafeJSON(cumulativeTimeline),
      comparison: toSafeJSON(comparisonData),
      peak_performance: toSafeJSON(peakPerformance),
      summary: toSafeJSON({
        total_data_points: timeline.length,
        date_range: {
          start: defaultStartDate.toISOString(),
          end: defaultEndDate.toISOString()
        },
        granularity,
        average_daily_impressions: timeline.length > 0 
          ? Math.round(timeline.reduce((sum, p) => sum + p.impressions, 0) / timeline.length)
          : 0,
        average_daily_clicks: timeline.length > 0 
          ? Math.round(timeline.reduce((sum, p) => sum + p.clicks, 0) / timeline.length)
          : 0
      })
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error("Error fetching performance timeline:", error);
    return Response.json(
      {
        error: "Failed to fetch performance timeline",
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      },
    );
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

