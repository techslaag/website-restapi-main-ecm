import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";


// Track ad events (impressions, clicks)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ad_id, event_type, user_id, session_id, visitor_id, device_type } = body;

    // Validate required fields
    if (!ad_id || !event_type) {
      return Response.json(
        { error: "Missing required fields: ad_id, event_type" },
        { status: 400 }
      );
    }

    // Validate event_type
    const validEventTypes = ["impression", "click", "hover", "view"];
    if (!validEventTypes.includes(event_type)) {
      return Response.json(
        { error: "Invalid event_type. Must be one of: impression, click, hover, view" },
        { status: 400 }
      );
    }

    // Get client IP and user agent
    const headersList = headers();
    const user_ip = headersList.get("x-forwarded-for") || 
                   headersList.get("x-real-ip") || 
                   "";
    const user_agent = headersList.get("user-agent") || "";
    const referer_url = headersList.get("referer") || "";

    // Verify ad exists (checking both advertising and regular post types for now)
    const adExists = await prisma.mod180_posts.findUnique({
      where: {
        ID: BigInt(ad_id),
        post_status: "publish"
      }
    });

    if (!adExists) {
      return Response.json(
        { error: "Ad not found or not published" },
        { status: 404 }
      );
    }

    // Log for debugging
    console.log('Ad found:', { id: adExists.ID, type: adExists.post_type, status: adExists.post_status });

    // For impressions, implement basic deduplication (same IP + same ad within 1 hour)
    if (event_type === "impression") {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const recentImpression = await prisma.ad_insights.findFirst({
        where: {
          ad_id: BigInt(ad_id),
          event_type: "impression",
          user_ip,
          timestamp: {
            gte: oneHourAgo
          }
        }
      });

      // Skip if recent impression from same IP exists
      if (recentImpression) {
        return Response.json({
          message: "Duplicate impression ignored",
          tracked: false 
        });
      }
    }

    // Create insight record
    const insight = await prisma.ad_insights.create({
      data: {
        ad_id: BigInt(ad_id),
        event_type,
        user_ip: user_ip.slice(0, 45),
        user_agent: user_agent.slice(0, 1000),
        referer_url: referer_url.slice(0, 1000),
        user_id: user_id ? BigInt(user_id) : null,
        session_id: session_id || "",
        visitor_id: visitor_id || "",
        device_type: device_type || "",
        timestamp: new Date()
      }
    });

    return Response.json({
      message: "Event tracked successfully",
      tracked: true,
      insight_id: insight.id
    });

  } catch (error) {
    console.error("Error tracking ad insight:", error);
    return Response.json({ 
      success: false,
      error: 'Failed to track ad insight',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500
    });
  }
}

// Get ad insights analytics
export async function GET(req: Request) {
  try {
    const queryParams = extractQueryParams(req);
    const { ad_id, event_type, start_date, end_date, limit = "100", position, device_type, visitor_id } = queryParams;

    let whereClause: any = {};

    if (ad_id) {
      whereClause.ad_id = BigInt(ad_id);
    }

    if (event_type) {
      whereClause.event_type = event_type;
    }

    if (device_type) {
      whereClause.device_type = device_type;
    }

    if (visitor_id) {
      whereClause.visitor_id = visitor_id;
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
        if (whereClause.ad_id) {
          // If ad_id already specified, ensure it's in the position filter
          const requestedAdId = whereClause.ad_id;
          if (adIds.includes(requestedAdId)) {
            whereClause.ad_id = requestedAdId;
          } else {
            whereClause.ad_id = BigInt(-1); // Non-existent ID
          }
        } else {
          whereClause.ad_id = {
            in: adIds
          };
        }
      } else {
        // No ads found with this position
        whereClause.ad_id = BigInt(-1);
      }
    }

    const insights = await prisma.ad_insights.findMany({
      where: whereClause,
      include: {
        ad: {
          select: {
            ID: true,
            post_title: true,
            post_name: true
          }
        }
      },
      orderBy: {
        timestamp: "desc"
      },
      take: parseInt(limit)
    });

    // Get summary stats if ad_id is provided
    let summary = null;
    if (ad_id) {
      const stats = await prisma.ad_insights.groupBy({
        by: ["event_type"],
        where: {
          ad_id: BigInt(ad_id),
          ...(start_date || end_date ? {
            timestamp: {
              ...(start_date ? { gte: new Date(start_date) } : {}),
              ...(end_date ? { lte: new Date(end_date) } : {})
            }
          } : {})
        },
        _count: {
          id: true
        }
      });

      summary = stats.reduce((acc, stat) => {
        acc[stat.event_type] = stat._count.id;
        return acc;
      }, {} as Record<string, number>);
    }

    return Response.json(toSafeJSON({
      insights,
      summary,
      total: insights.length
    }), {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error("Error fetching ad insights:", error);
    return Response.json({ 
      success: false,
      error: 'Failed to fetch ad insights',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
