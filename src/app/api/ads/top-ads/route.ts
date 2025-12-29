import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const queryParams = extractQueryParams(req);
    const { 
      start_date, 
      end_date,
      device_type,
      position,
      limit = 10,
      sort_by = "impressions", // impressions, clicks, ctr
      order = "desc"
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
    let whereClause: any = { ...dateFilter };
    
    // Note: device_type filtering will be done in post-processing
    // since the field doesn't exist in the database

    // Get all insights and group manually since groupBy might have issues
    const allInsights = await prisma.ad_insights.findMany({
      where: whereClause,
      select: {
        ad_id: true,
        event_type: true,
        id: true
      }
    });

    // Group manually
    const topAds: Array<{ad_id: bigint, event_type: string, _count: {id: number}}> = [];
    const groupMap = new Map<string, number>();
    
    allInsights.forEach(insight => {
      const key = `${insight.ad_id}-${insight.event_type}`;
      groupMap.set(key, (groupMap.get(key) || 0) + 1);
    });
    
    groupMap.forEach((count, key) => {
      const [ad_id, event_type] = key.split('-');
      topAds.push({
        ad_id: BigInt(ad_id),
        event_type,
        _count: { id: count }
      });
    });

    // Group metrics by ad_id
    const adMetrics: Record<string, any> = {};
    topAds.forEach(item => {
      const adId = item.ad_id.toString();
      if (!adMetrics[adId]) {
        adMetrics[adId] = {
          ad_id: adId,
          impressions: 0,
          clicks: 0,
          hovers: 0,
          views: 0,
          total_events: 0
        };
      }
      adMetrics[adId][item.event_type + 's'] = item._count.id;
      adMetrics[adId].total_events += item._count.id;
    });

    // Calculate CTR and other metrics
    Object.values(adMetrics).forEach((ad: any) => {
      ad.ctr = ad.impressions > 0 
        ? Number((ad.clicks / ad.impressions * 100).toFixed(2))
        : 0;
      ad.engagement_rate = ad.impressions > 0
        ? Number(((ad.clicks + ad.views + ad.hovers) / ad.impressions * 100).toFixed(2))
        : 0;
    });

    // Sort by specified criteria
    const sortedAds = Object.values(adMetrics).sort((a: any, b: any) => {
      let aValue, bValue;
      
      switch (sort_by) {
        case 'clicks':
          aValue = a.clicks;
          bValue = b.clicks;
          break;
        case 'ctr':
          aValue = a.ctr;
          bValue = b.ctr;
          break;
        default: // impressions
          aValue = a.impressions;
          bValue = b.impressions;
      }
      
      return order === 'desc' ? bValue - aValue : aValue - bValue;
    });

    // Get top ads based on limit
    const topAdIds = sortedAds
      .slice(0, parseInt(limit.toString()))
      .map((ad: any) => BigInt(ad.ad_id));

    // Enrich with post details
    const topAdsWithDetails = await Promise.all(
      topAdIds.map(async (adId) => {
        try {
          const ad = await prisma.mod180_posts.findUnique({
            where: { ID: adId },
            select: {
              ID: true,
              post_title: true,
              post_name: true,
              meta: {
                where: {
                  meta_key: { in: ["position", "redirect_url", "ad_position"] }
                },
                select: {
                  meta_key: true,
                  meta_value: true
                }
              }
            }
          });

          const meta = ad?.meta?.reduce((acc: Record<string, string>, m: any) => {
            if (m.meta_key) {
              acc[m.meta_key] = m.meta_value;
            }
            return acc;
          }, {}) || {};

          const metrics = adMetrics[adId.toString()];

          return {
            ad_id: adId.toString(),
            title: ad?.post_title || "Unknown Ad",
            slug: ad?.post_name || "",
            position: meta.position || meta.ad_position || "unknown",
            redirect_url: meta.redirect_url || "",
            ...metrics
          };
        } catch (error) {
          console.error(`Error fetching ad ${adId}:`, error);
          const metrics = adMetrics[adId.toString()];
          return {
            ad_id: adId.toString(),
            title: "Unknown Ad",
            slug: "",
            position: "unknown",
            redirect_url: "",
            ...metrics
          };
        }
      })
    );

    // Filter by position if specified
    const finalAds = position && position !== ''
      ? topAdsWithDetails.filter(ad => ad.position === position)
      : topAdsWithDetails;

    // Calculate summary statistics
    const summary = finalAds.reduce((acc, ad) => ({
      total_impressions: acc.total_impressions + ad.impressions,
      total_clicks: acc.total_clicks + ad.clicks,
      total_ads: acc.total_ads + 1,
      average_ctr: 0 // calculated below
    }), {
      total_impressions: 0,
      total_clicks: 0,
      total_ads: 0,
      average_ctr: 0
    });

    summary.average_ctr = summary.total_impressions > 0
      ? Number((summary.total_clicks / summary.total_impressions * 100).toFixed(2))
      : 0;

    const response = {
      data: finalAds,
      summary,
      filters: {
        start_date: dateFilter.timestamp?.gte?.toISOString().split('T')[0],
        end_date: dateFilter.timestamp?.lte?.toISOString().split('T')[0],
        device_type,
        position,
        sort_by,
        order,
        limit: parseInt(limit.toString())
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
    console.error("Top ads error:", error);
    return Response.json(
      {
        error: "Failed to fetch top ads",
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

