import { toSafeJSON } from "@/lib/utils/index";
import { FALLBACK_POSITION_CONFIGS, getPositionsByCategory, formatPositionForResponse } from "@/lib/utils/adPositionUtils";
import { getAdPositionConfigurations, extractPositionMappings } from "@/lib/utils/wordpressOptionsUtils";

export const dynamic = "force-dynamic";

// Get ad position configurations
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'detailed';
    const category = url.searchParams.get('category');

    if (format === 'grouped') {
      // Return positions grouped by category
      const groupedPositions = await getPositionsByCategory();
      
      // Filter by category if specified
      if (category) {
        const filteredPositions = groupedPositions[category] || [];
        return Response.json(toSafeJSON({
          category,
          positions: filteredPositions
        }), {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });
      }

      return Response.json(toSafeJSON(groupedPositions), {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    if (format === 'simple') {
      // Return simple key-value mapping for dropdowns
      const wpMappings = await extractPositionMappings();
      const fallbackMapping = Object.keys(FALLBACK_POSITION_CONFIGS).reduce((acc, key) => {
        acc[key] = FALLBACK_POSITION_CONFIGS[key].label;
        return acc;
      }, {} as Record<string, string>);
      
      const simpleMapping = { ...fallbackMapping, ...wpMappings };

      return Response.json(toSafeJSON(simpleMapping), {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // Default: return detailed configuration
    const wpMappings = await extractPositionMappings();
    const wpConfigs = await getAdPositionConfigurations();
    const allPositionKeys = [...Object.keys(wpMappings), ...Object.keys(FALLBACK_POSITION_CONFIGS)];
    const uniqueKeys = Array.from(new Set(allPositionKeys));
    
    const detailedPositions = await Promise.all(
      uniqueKeys.map(key => formatPositionForResponse(key))
    );
    
    const groupedPositions = await getPositionsByCategory();

    return Response.json(toSafeJSON({
      positions: detailedPositions,
      total: detailedPositions.length,
      categories: Object.keys(groupedPositions),
      wordpress_config: wpConfigs
    }), {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS', 
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error("Error fetching position configurations:", error);
    return Response.json({ 
      success: false,
      error: 'Failed to fetch position configurations',
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}