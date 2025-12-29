import { NextRequest } from 'next/server';
import prisma from "@/lib/prisma";
import authMiddleware from "@/lib/auth/authMiddleware";
import { extractQueryParams, forceNumberOrDefault } from "@/lib/utils/index";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/posts/archive/export
 * Export archived posts in various formats (CSV, JSON, XML)
 * Requires authentication - subscription users get full access, others get limited access
 */
export async function GET(req: NextRequest) {
  return authMiddleware(req, async (user) => {
    try {
      const queryParams = extractQueryParams(req);
      
      const format = queryParams.format || 'csv', // csv, json, xml
        limit = forceNumberOrDefault(queryParams.limit, 100), // Max 1000 for performance
        year = queryParams.year ? parseInt(queryParams.year) : null,
        month = queryParams.month ? parseInt(queryParams.month) : null,
        search = queryParams.search?.trim() || null,
        category = queryParams.category?.trim() || null,
        author = queryParams.author?.trim() || null;

      // Limit max export size for performance
      const maxLimit = user ? 1000 : 50; // Authenticated users can export more
      const effectiveLimit = Math.min(limit, maxLimit);

      // Check if user has subscription to access premium archived content
      const hasSubscription = user ? await require('@/lib/utils/subscriptionUtils').hasActiveSubscription(user) : false;
      
      // Build date filters
      const dateFilters: Prisma.mod180_postsWhereInput['post_date_gmt'] = {};
      
      if (year || month) {
        if (year && month) {
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0, 23, 59, 59, 999);
          dateFilters.gte = startDate;
          dateFilters.lte = endDate;
        } else if (year) {
          const startDate = new Date(year, 0, 1);
          const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
          dateFilters.gte = startDate;
          dateFilters.lte = endDate;
        }
      }

      // Build search filters
      const searchFilters: Prisma.mod180_postsWhereInput[] = [];
      
      if (search) {
        searchFilters.push({
          OR: [
            { post_title: { contains: search } },
            { post_excerpt: { contains: search } }
          ]
        });
      }
      
      if (category) {
        searchFilters.push({
          termRelationships: {
            some: {
              taxonomy: {
                taxonomy: 'category',
                term: {
                  OR: [
                    { name: { contains: category } },
                    { slug: { contains: category } }
                  ]
                }
              }
            }
          }
        });
      }
      
      if (author) {
        searchFilters.push({
          author: {
            OR: [
              { display_name: { contains: author } },
              { user_nicename: { contains: author } }
            ]
          }
        });
      }

      const whereQuery: Prisma.mod180_postsWhereInput = {
        post_type: "post",
        post_status: "publish",
        archived: true,
        archivedAt: { not: null },
        ...(Object.keys(dateFilters).length > 0 ? { post_date_gmt: dateFilters } : {}),
        ...(searchFilters.length > 0 ? { AND: searchFilters } : {}),
        ...(!hasSubscription 
          ? {
              OR: [
                {
                  meta: {
                    none: {
                      meta_key: 'post_prestige'
                    }
                  }
                },
                {
                  meta: {
                    some: {
                      meta_key: 'post_prestige',
                      meta_value: 'gratuit'
                    }
                  }
                }
              ]
            }
          : {}
        ),
      };

      const posts = await prisma.mod180_posts.findMany({
        where: whereQuery,
        take: effectiveLimit,
        orderBy: [
          { archivedAt: "desc" },
          { post_date_gmt: "desc" },
        ],
        select: {
          ID: true,
          post_title: true,
          post_excerpt: true,
          post_date_gmt: true,
          archivedAt: true,
          author: {
            select: {
              display_name: true,
              user_nicename: true,
            },
          },
          termRelationships: {
            select: {
              taxonomy: {
                select: {
                  taxonomy: true,
                  term: {
                    select: {
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Format the data for export
      const exportData = posts.map((post) => {
        const categories = post.termRelationships
          .filter(rel => rel.taxonomy.taxonomy === 'category')
          .map(rel => rel.taxonomy.term.name)
          .join(', ');

        return {
          id: post.ID.toString(),
          title: post.post_title,
          excerpt: post.post_excerpt || '',
          author: post.author.display_name,
          categories: categories,
          publish_date: post.post_date_gmt?.toISOString() || '',
          archived_date: post.archivedAt?.toISOString() || '',
          days_before_archive: post.post_date_gmt && post.archivedAt 
            ? Math.floor((new Date(post.archivedAt).getTime() - new Date(post.post_date_gmt).getTime()) / (1000 * 60 * 60 * 24))
            : null
        };
      });

      // Generate export based on format
      let responseContent: string;
      let contentType: string;
      let filename: string;

      const timestamp = new Date().toISOString().split('T')[0];
      
      switch (format.toLowerCase()) {
        case 'json':
          responseContent = JSON.stringify({
            metadata: {
              exported_at: new Date().toISOString(),
              total_records: exportData.length,
              max_limit: maxLimit,
              user_subscription: hasSubscription,
              filters: {
                year, month, search, category, author
              }
            },
            data: exportData
          }, null, 2);
          contentType = 'application/json';
          filename = `ecomatin-archives-${timestamp}.json`;
          break;

        case 'xml':
          responseContent = `<?xml version="1.0" encoding="UTF-8"?>
<archive_export>
  <metadata>
    <exported_at>${new Date().toISOString()}</exported_at>
    <total_records>${exportData.length}</total_records>
    <max_limit>${maxLimit}</max_limit>
    <user_subscription>${hasSubscription}</user_subscription>
  </metadata>
  <posts>
${exportData.map(post => `    <post>
      <id>${post.id}</id>
      <title><![CDATA[${post.title}]]></title>
      <excerpt><![CDATA[${post.excerpt}]]></excerpt>
      <author><![CDATA[${post.author}]]></author>
      <categories><![CDATA[${post.categories}]]></categories>
      <publish_date>${post.publish_date}</publish_date>
      <archived_date>${post.archived_date}</archived_date>
      <days_before_archive>${post.days_before_archive}</days_before_archive>
    </post>`).join('\n')}
  </posts>
</archive_export>`;
          contentType = 'application/xml';
          filename = `ecomatin-archives-${timestamp}.xml`;
          break;

        case 'csv':
        default:
          const csvHeaders = [
            'ID',
            'Title',
            'Excerpt', 
            'Author',
            'Categories',
            'Publish Date',
            'Archived Date',
            'Days Before Archive'
          ];
          
          const csvRows = exportData.map(post => [
            post.id,
            `"${post.title.replace(/"/g, '""')}"`,
            `"${post.excerpt.replace(/"/g, '""')}"`,
            `"${post.author.replace(/"/g, '""')}"`,
            `"${post.categories.replace(/"/g, '""')}"`,
            post.publish_date,
            post.archived_date,
            post.days_before_archive?.toString() || ''
          ].join(','));

          responseContent = [csvHeaders.join(','), ...csvRows].join('\n');
          contentType = 'text/csv';
          filename = `ecomatin-archives-${timestamp}.csv`;
          break;
      }

      // Return the export file
      return new Response(responseContent, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-cache',
          'X-Export-Count': exportData.length.toString(),
          'X-Export-Limit': effectiveLimit.toString(),
          'X-User-Subscription': hasSubscription.toString()
        }
      });

    } catch (error) {
      console.error('Archive export API error:', error);
      return Response.json(
        {
          success: false,
          error: 'Failed to export archive data',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  });
}