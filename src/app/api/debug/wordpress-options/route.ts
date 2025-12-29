import { toSafeJSON } from "@/lib/utils/index";
import { getAdPositionConfigurations, searchWordPressOptions } from "@/lib/utils/wordpressOptionsUtils";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Debug endpoint to examine WordPress options
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    
    if (search) {
      // Search for specific options
      const options = await searchWordPressOptions(search);
      return Response.json(toSafeJSON({
        search_term: search,
        results: options
      }), {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    // Get all ad-related configurations
    const adConfigs = await getAdPositionConfigurations();
    
    // Search for various ad-related options
    const searches = ['adi', 'position', 'ad_', 'advertising'];
    const allResults: Record<string, any> = {};
    
    for (const searchTerm of searches) {
      const results = await searchWordPressOptions(searchTerm);
      if (results.length > 0) {
        allResults[searchTerm] = results;
      }
    }
    
    // Get a sample of all options to see the structure
    const sampleOptions = await prisma.mod180_options.findMany({
      select: {
        option_name: true,
        option_value: true
      },
      take: 20,
      orderBy: {
        option_name: 'asc'
      }
    });
    
    return Response.json(toSafeJSON({
      ad_configurations: adConfigs,
      search_results: allResults,
      sample_options: sampleOptions,
      note: "Use ?search=term to search for specific options"
    }), {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error("Error in debug endpoint:", error);
    return Response.json({ 
      success: false,
      error: 'Failed to fetch debug information',
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