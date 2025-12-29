import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const queryParams = extractQueryParams(req);
    const { 
      ad_id, 
      start_date, 
      end_date, 
      group_by = "day",
      include_device_breakdown = "false"
    } = queryParams;

    // Build where clause
    let whereClause: any = {};
    
    if (ad_id) {
      whereClause.ad_id = BigInt(ad_id);
    }

    if (start_date || end_date) {
      whereClause.timestamp = {};
      if (start_date) {
        whereClause.timestamp.gte = new Date(start_date);
      }
      if (end_date) {
        whereClause.timestamp.lte = new Date(end_date);
      }
    }

    // Get overall unique visitors count
    const uniqueVisitors = await prisma.ad_insights.findMany({
      where: {
        ...whereClause,
        visitor_id: {
          not: ""
        }
      },
      select: {
        visitor_id: true
      },
      distinct: ['visitor_id']
    });

    const totalUniqueVisitors = uniqueVisitors.length;

    // Get new vs returning visitors
    const visitorSessions = await prisma.ad_insights.groupBy({
      by: ['visitor_id'],
      where: {
        ...whereClause,
        visitor_id: {
          not: ""
        }
      },
      _count: {
        id: true
      }
    });

    const newVisitors = visitorSessions.filter(v => v._count.id === 1).length;
    const returningVisitors = visitorSessions.filter(v => v._count.id > 1).length;

    // Get visitors by time period
    let visitorsByTime: any[] = [];
    
    if (group_by === "day" || group_by === "week" || group_by === "month") {
      const insights = await prisma.ad_insights.findMany({
        where: {
          ...whereClause,
          visitor_id: {
            not: ""
          }
        },
        select: {
          visitor_id: true,
          timestamp: true
        }
      });

      // Group by time period
      const timeGroups: Record<string, Set<string>> = {};
      
      insights.forEach(insight => {
        let timeKey: string;
        const date = new Date(insight.timestamp || new Date());
        
        if (group_by === "day") {
          timeKey = date.toISOString().split('T')[0];
        } else if (group_by === "week") {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          timeKey = weekStart.toISOString().split('T')[0];
        } else { // month
          timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
        
        if (!timeGroups[timeKey]) {
          timeGroups[timeKey] = new Set();
        }
        timeGroups[timeKey].add(insight.visitor_id || '');
      });

      visitorsByTime = Object.entries(timeGroups).map(([date, visitors]) => ({
        date,
        unique_visitors: visitors.size
      })).sort((a, b) => a.date.localeCompare(b.date));
    }

    // Get device breakdown if requested
    let deviceBreakdown = null;
    if (include_device_breakdown === "true") {
      const deviceStats = await prisma.ad_insights.groupBy({
        by: ['device_type'],
        where: {
          ...whereClause,
          visitor_id: {
            not: ""
          },
          device_type: {
            not: ""
          }
        },
        _count: {
          visitor_id: true
        }
      });

      // Get unique visitors per device
      const deviceUniqueVisitors = await Promise.all(
        deviceStats.map(async (stat) => {
          const uniqueByDevice = await prisma.ad_insights.findMany({
            where: {
              ...whereClause,
              device_type: stat.device_type,
              visitor_id: {
                not: ""
              }
            },
            select: {
              visitor_id: true
            },
            distinct: ['visitor_id']
          });

          return {
            device_type: stat.device_type,
            unique_visitors: uniqueByDevice.length,
            total_visits: stat._count.visitor_id
          };
        })
      );

      deviceBreakdown = deviceUniqueVisitors;
    }

    // Get top ads by unique visitors if no specific ad_id
    let topAdsByVisitors = null;
    if (!ad_id) {
      const adVisitors = await prisma.ad_insights.findMany({
        where: {
          ...whereClause,
          visitor_id: {
            not: ""
          }
        },
        select: {
          ad_id: true,
          visitor_id: true,
          ad: {
            select: {
              ID: true,
              post_title: true
            }
          }
        }
      });

      // Group by ad and count unique visitors
      const adVisitorMap: Record<string, { visitors: Set<string>, ad: any }> = {};
      
      adVisitors.forEach(insight => {
        const adIdStr = insight.ad_id.toString();
        if (!adVisitorMap[adIdStr]) {
          adVisitorMap[adIdStr] = {
            visitors: new Set(),
            ad: insight.ad
          };
        }
        adVisitorMap[adIdStr].visitors.add(insight.visitor_id || '');
      });

      topAdsByVisitors = Object.entries(adVisitorMap)
        .map(([ad_id, data]) => ({
          ad_id: BigInt(ad_id),
          ad_title: data.ad?.post_title || 'Unknown',
          unique_visitors: data.visitors.size
        }))
        .sort((a, b) => b.unique_visitors - a.unique_visitors)
        .slice(0, 10);
    }

    return Response.json({
      summary: toSafeJSON({
        total_unique_visitors: totalUniqueVisitors,
        new_visitors: newVisitors,
        returning_visitors: returningVisitors,
        avg_sessions_per_visitor: totalUniqueVisitors > 0 
          ? (visitorSessions.reduce((sum, v) => sum + v._count.id, 0) / totalUniqueVisitors).toFixed(2)
          : "0"
      }),
      visitors_by_time: toSafeJSON(visitorsByTime),
      device_breakdown: toSafeJSON(deviceBreakdown),
      top_ads_by_visitors: toSafeJSON(topAdsByVisitors),
      query_params: toSafeJSON({
        ad_id,
        start_date,
        end_date,
        group_by,
        include_device_breakdown
      })
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error("Error fetching visitor analytics:", error);
    return Response.json(
      {
        error: "Failed to fetch visitor analytics",
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

