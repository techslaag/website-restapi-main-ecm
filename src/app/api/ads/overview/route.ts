import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";

export const dynamic = "force-dynamic";

// Get overview statistics (stats grid) with filters
export async function GET(req: Request) {
  try {
    const queryParams = extractQueryParams(req);
    const { 
      ad_id,
      start_date, 
      end_date,
      device_type,
      position,
      compare_period = "false"
    } = queryParams;

    // Build date filter
    let dateFilter: any = {};
    const now = new Date();
    
    // Parse dates and validate
    let startDateObj: Date | null = null;
    let endDateObj: Date | null = null;
    
    if (start_date) {
      startDateObj = new Date(start_date);
      if (isNaN(startDateObj.getTime())) {
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
    }
    
    if (end_date) {
      endDateObj = new Date(end_date);
      if (isNaN(endDateObj.getTime())) {
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
    }
    
    // Set date filter
    if (startDateObj || endDateObj) {
      dateFilter.timestamp = {};
      if (startDateObj) {
        // Don't cap to current date - allow future dates for testing
        dateFilter.timestamp.gte = startDateObj;
      }
      if (endDateObj) {
        // Don't cap to current date - allow future dates for testing
        dateFilter.timestamp.lte = endDateObj;
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
    let whereClause: any = { ...dateFilter };
    
    if (ad_id) {
      whereClause.ad_id = BigInt(ad_id);
    }
    
    if (device_type && device_type !== '') {
      whereClause.device_type = device_type;
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

    // Get overall stats
    const overallStats = await prisma.ad_insights.groupBy({
      by: ["event_type"],
      where: whereClause,
      _count: {
        id: true
      }
    });

    const stats = overallStats.reduce((acc: Record<string, number>, stat: any) => {
      acc[stat.event_type] = stat._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Get unique visitors count using session_id as proxy
    const uniqueVisitorsData = await prisma.ad_insights.findMany({
      where: {
        ...whereClause,
        session_id: {
          not: null
        }
      },
      select: {
        session_id: true
      },
      distinct: ['session_id']
    });
    
    const uniqueVisitors = uniqueVisitorsData.length;

    // Calculate additional metrics
    const impressions = stats.impression || 0;
    const clicks = stats.click || 0;
    const hovers = stats.hover || 0;
    const views = stats.view || 0;
    const ctr = impressions > 0 ? (clicks / impressions * 100).toFixed(2) + "%" : "0%";
    const engagement_rate = impressions > 0 
      ? ((clicks + views + hovers) / impressions * 100).toFixed(2) + "%" 
      : "0%";

    // Get average metrics per day
    const daysDiff = dateFilter.timestamp?.gte && dateFilter.timestamp?.lte
      ? Math.ceil((dateFilter.timestamp.lte.getTime() - dateFilter.timestamp.gte.getTime()) / (1000 * 60 * 60 * 24))
      : 30;
    
    const avgImpressionsPerDay = Math.round(impressions / daysDiff);
    const avgClicksPerDay = Math.round(clicks / daysDiff);
    const avgVisitorsPerDay = Math.round(uniqueVisitors / daysDiff);

    // Build overview response
    const overview = {
      impressions,
      clicks,
      hovers,
      views,
      unique_visitors: uniqueVisitors,
      ctr,
      engagement_rate,
      avg_impressions_per_day: avgImpressionsPerDay,
      avg_clicks_per_day: avgClicksPerDay,
      avg_visitors_per_day: avgVisitorsPerDay
    };

    // Get comparison data if requested
    let comparison = null;
    if (compare_period === "true" && dateFilter.timestamp?.gte && dateFilter.timestamp?.lte) {
      const periodDuration = dateFilter.timestamp.lte.getTime() - dateFilter.timestamp.gte.getTime();
      const compareEndDate = new Date(dateFilter.timestamp.gte.getTime() - 1);
      const compareStartDate = new Date(compareEndDate.getTime() - periodDuration);
      
      const compareWhereClause = {
        ...whereClause,
        timestamp: {
          gte: compareStartDate,
          lte: compareEndDate
        }
      };

      const compareStats = await prisma.ad_insights.groupBy({
        by: ["event_type"],
        where: compareWhereClause,
        _count: {
          id: true
        }
      });

      const previousStats = compareStats.reduce((acc: Record<string, number>, stat: any) => {
        acc[stat.event_type] = stat._count.id;
        return acc;
      }, {} as Record<string, number>);

      const previousUniqueVisitors = await prisma.ad_insights.findMany({
        where: {
          ...compareWhereClause,
          session_id: {
            not: null
          }
        },
        select: {
          session_id: true
        },
        distinct: ['session_id']
      });

      const prevImpressions = previousStats.impression || 0;
      const prevClicks = previousStats.click || 0;
      const prevUniqueVisitors = previousUniqueVisitors.length;
      const prevCtr = prevImpressions > 0 ? (prevClicks / prevImpressions * 100) : 0;

      comparison = {
        current_period: {
          impressions,
          clicks,
          unique_visitors: uniqueVisitors,
          ctr: parseFloat(ctr.replace('%', ''))
        },
        previous_period: {
          impressions: prevImpressions,
          clicks: prevClicks,
          unique_visitors: prevUniqueVisitors,
          ctr: prevCtr
        },
        changes: {
          impressions: prevImpressions > 0 
            ? Number(((impressions - prevImpressions) / prevImpressions * 100).toFixed(2))
            : 100,
          clicks: prevClicks > 0 
            ? Number(((clicks - prevClicks) / prevClicks * 100).toFixed(2))
            : 100,
          unique_visitors: prevUniqueVisitors > 0 
            ? Number(((uniqueVisitors - prevUniqueVisitors) / prevUniqueVisitors * 100).toFixed(2))
            : 100,
          ctr: prevCtr > 0
            ? Number((parseFloat(ctr.replace('%', '')) - prevCtr).toFixed(2))
            : parseFloat(ctr.replace('%', ''))
        }
      };
    }

    const response = {
      data: overview,
      comparison,
      filters: {
        start_date: dateFilter.timestamp?.gte?.toISOString().split('T')[0],
        end_date: dateFilter.timestamp?.lte?.toISOString().split('T')[0],
        ad_id,
        device_type,
        position,
        compare_period
      },
      period_info: {
        days: daysDiff,
        date_range: {
          start: dateFilter.timestamp?.gte?.toISOString(),
          end: dateFilter.timestamp?.lte?.toISOString()
        }
      }
    };

    return Response.json(toSafeJSON(response), {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error("Overview stats error:", error);
    return Response.json({ 
      success: false,
      error: 'Failed to fetch overview statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

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