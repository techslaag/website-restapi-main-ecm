import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { getPositionLabel, formatPositionForResponse } from "@/lib/utils/adPositionUtils";

export const dynamic = "force-dynamic";

// Cache for position data to avoid repeated lookups
const positionCache = new Map<string, any>();

// Get all ads with analytics data
export async function GET(req: Request) {
  try {
    const queryParams = extractQueryParams(req);
    const includeAnalytics = queryParams.include_analytics === 'true';
    const orderBy = queryParams.order_by || 'updated_date';
    const order = queryParams.order || 'desc';
    const search = queryParams.search || '';
    
    // Pagination parameters
    const page = parseInt(queryParams.page || '1');
    const limit = parseInt(queryParams.limit || '10');
    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {
      post_type: 'advertising',
      post_status: 'publish'
    };
    
    // Add search condition if search term is provided
    // MySQL's contains is case-insensitive by default
    if (search) {
      whereClause.post_title = {
        contains: search
      };
    }

    // Get total count for pagination
    const totalCount = await prisma.mod180_posts.count({
      where: whereClause
    });

    // Get paginated ads with metadata
    const ads = await prisma.mod180_posts.findMany({
      where: whereClause,
      skip: skip,
      take: limit,
      select: {
        ID: true,
        post_title: true,
        post_date: true,
        post_date_gmt: true,
        post_modified: true,
        post_modified_gmt: true,
        post_status: true,
        meta: {
          select: {
            meta_key: true,
            meta_value: true
          },
          where: {
            meta_key: {
              in: ['position', 'ad_type', 'advertiser']
            }
          }
        }
      },
      orderBy: orderBy === 'updated_date' ? {
        post_modified_gmt: order as 'asc' | 'desc'
      } : {
        post_date_gmt: order as 'asc' | 'desc'
      }
    });

    // Get all ad IDs for batch analytics query
    const adIds = ads.map(ad => ad.ID);
    
    // Batch fetch analytics data if requested
    let analyticsData: Record<string, { impressions: number; clicks: number }> = {};
    if (includeAnalytics && adIds.length > 0) {
      const analyticsResults = await prisma.ad_insights.groupBy({
        by: ['ad_id', 'event_type'],
        where: {
          ad_id: { in: adIds }
        },
        _count: {
          _all: true
        }
      });
      
      // Process analytics results into a map
      analyticsResults.forEach(result => {
        const adIdStr = result.ad_id.toString();
        if (!analyticsData[adIdStr]) {
          analyticsData[adIdStr] = { impressions: 0, clicks: 0 };
        }
        
        if (result.event_type === 'impression') {
          analyticsData[adIdStr].impressions = result._count._all;
        } else if (result.event_type === 'click') {
          analyticsData[adIdStr].clicks = result._count._all;
        }
      });
    }

    // Process ads data
    const processedAds = await Promise.all(ads.map(async (ad) => {
      // Extract metadata
      const metaData = ad.meta.reduce((acc: any, m) => {
        if (m.meta_key) {
          acc[m.meta_key] = m.meta_value;
        }
        return acc;
      }, {});

      const positionKey = metaData.position || '';
      
      // Use cached position data if available
      let positionData;
      if (positionCache.has(positionKey)) {
        positionData = positionCache.get(positionKey);
      } else {
        positionData = await formatPositionForResponse(positionKey);
        positionCache.set(positionKey, positionData);
      }
      
      const adType = metaData.ad_type || '';
      const advertiser = metaData.advertiser || '';

      let analytics = {
        impressions: 0,
        clicks: 0,
        ctr: 0
      };

      // Use pre-fetched analytics data
      if (includeAnalytics) {
        const adAnalytics = analyticsData[ad.ID.toString()] || { impressions: 0, clicks: 0 };
        analytics = {
          impressions: adAnalytics.impressions,
          clicks: adAnalytics.clicks,
          ctr: adAnalytics.impressions > 0 ? Number(((adAnalytics.clicks / adAnalytics.impressions) * 100).toFixed(2)) : 0
        };
      }

      return {
        id: Number(ad.ID),
        title: ad.post_title,
        position: positionData.label,
        position_key: positionKey,
        position_category: positionData.category,
        ad_type: adType,
        advertiser,
        created_date: ad.post_date,
        updated_date: ad.post_modified,
        status: ad.post_status,
        ...analytics
      };
    }));

    return Response.json(toSafeJSON({
      success: true,
      data: processedAds,
      pagination: {
        total: totalCount,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    }), {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        // Add cache headers for 1 minute to reduce repeated requests
        'Cache-Control': 'private, max-age=60, must-revalidate',
        'Vary': 'Origin'
      }
    });

  } catch (error) {
    console.error("Ads list error:", error);
    return Response.json({ 
      success: false,
      error: 'Failed to fetch ads list',
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