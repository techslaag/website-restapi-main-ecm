import { NextRequest } from 'next/server';
import prisma from "@/lib/prisma";
import optionalAuthMiddleware from "@/lib/auth/optionalAuthMiddleware";

export const dynamic = "force-dynamic";

/**
 * GET /api/posts/archive/filters
 * Returns available filters for archived posts including categories, authors, and date ranges
 */
export async function GET(req: NextRequest) {
  return optionalAuthMiddleware(req, async (user) => {
    try {
      // Get available categories for archived posts
      const categories = await prisma.$queryRaw`
        SELECT DISTINCT t.term_id, t.name, t.slug, COUNT(p.ID) as post_count
        FROM mod180_terms t
        INNER JOIN mod180_term_taxonomy tt ON t.term_id = tt.term_id
        INNER JOIN mod180_term_relationships tr ON tt.term_taxonomy_id = tr.term_taxonomy_id
        INNER JOIN mod180_posts p ON tr.object_id = p.ID
        WHERE tt.taxonomy = 'category'
        AND p.post_type = 'post'
        AND p.post_status = 'publish'
        AND p.archived = TRUE
        AND p.archivedAt IS NOT NULL
        GROUP BY t.term_id, t.name, t.slug
        HAVING COUNT(p.ID) > 0
        ORDER BY t.name ASC
      `;

      // Get available authors for archived posts
      const authors = await prisma.$queryRaw`
        SELECT DISTINCT u.ID, u.display_name, u.user_nicename, COUNT(p.ID) as post_count
        FROM mod180_users u
        INNER JOIN mod180_posts p ON u.ID = p.post_author
        WHERE p.post_type = 'post'
        AND p.post_status = 'publish'
        AND p.archived = TRUE
        AND p.archivedAt IS NOT NULL
        GROUP BY u.ID, u.display_name, u.user_nicename
        HAVING COUNT(p.ID) > 0
        ORDER BY u.display_name ASC
      `;

      // Get available date ranges (years and months with content)
      const dateRanges = await prisma.$queryRaw`
        SELECT 
          YEAR(p.post_date_gmt) as year,
          MONTH(p.post_date_gmt) as month,
          COUNT(p.ID) as post_count,
          MIN(p.post_date_gmt) as earliest_date,
          MAX(p.post_date_gmt) as latest_date
        FROM mod180_posts p
        WHERE p.post_type = 'post'
        AND p.post_status = 'publish'
        AND p.archived = TRUE
        AND p.archivedAt IS NOT NULL
        GROUP BY YEAR(p.post_date_gmt), MONTH(p.post_date_gmt)
        ORDER BY year DESC, month DESC
      `;

      // Get archive statistics
      const stats = await prisma.$queryRaw`
        SELECT 
          COUNT(DISTINCT p.ID) as total_archived,
          COUNT(DISTINCT YEAR(p.post_date_gmt)) as years_span,
          MIN(p.post_date_gmt) as oldest_post,
          MAX(p.post_date_gmt) as newest_post,
          COUNT(DISTINCT p.post_author) as unique_authors,
          (SELECT COUNT(DISTINCT tr2.term_taxonomy_id) 
           FROM mod180_term_relationships tr2 
           INNER JOIN mod180_term_taxonomy tt2 ON tr2.term_taxonomy_id = tt2.term_taxonomy_id 
           INNER JOIN mod180_posts p2 ON tr2.object_id = p2.ID
           WHERE tt2.taxonomy = 'category' 
           AND p2.post_type = 'post' 
           AND p2.post_status = 'publish' 
           AND p2.archived = TRUE 
           AND p2.archivedAt IS NOT NULL) as unique_categories
        FROM mod180_posts p
        WHERE p.post_type = 'post'
        AND p.post_status = 'publish'
        AND p.archived = TRUE
        AND p.archivedAt IS NOT NULL
      `;

      // Format date ranges into a more usable structure
      const yearMonthMap = new Map();
      
      if (Array.isArray(dateRanges)) {
        dateRanges.forEach((range: any) => {
          const year = Number(range.year);
          if (!yearMonthMap.has(year)) {
            yearMonthMap.set(year, {
              year,
              months: [],
              total_posts: 0
            });
          }
          
          yearMonthMap.get(year).months.push({
            month: Number(range.month),
            month_name: new Date(year, range.month - 1).toLocaleDateString('fr-FR', { month: 'long' }),
            post_count: Number(range.post_count)
          });
          
          yearMonthMap.get(year).total_posts += Number(range.post_count);
        });
      }

      const formattedDateRanges = Array.from(yearMonthMap.values())
        .sort((a, b) => b.year - a.year)
        .map(year => ({
          ...year,
          months: year.months.sort((a: any, b: any) => b.month - a.month)
        }));

      return Response.json({
        success: true,
        data: {
          categories: Array.isArray(categories) ? categories.map((cat: any) => ({
            id: Number(cat.term_id),
            name: cat.name,
            slug: cat.slug,
            post_count: Number(cat.post_count)
          })) : [],
          authors: Array.isArray(authors) ? authors.map((author: any) => ({
            id: Number(author.ID),
            display_name: author.display_name,
            username: author.user_nicename,
            post_count: Number(author.post_count)
          })) : [],
          date_ranges: formattedDateRanges,
          statistics: Array.isArray(stats) && stats[0] ? {
            total_archived: Number(stats[0].total_archived),
            years_span: Number(stats[0].years_span),
            oldest_post: stats[0].oldest_post,
            newest_post: stats[0].newest_post,
            unique_authors: Number(stats[0].unique_authors),
            unique_categories: Number(stats[0].unique_categories)
          } : {
            total_archived: 0,
            years_span: 0,
            oldest_post: null,
            newest_post: null,
            unique_authors: 0,
            unique_categories: 0
          },
          has_subscription: false
        }
      });
    } catch (error) {
      console.error('Archive filters API error:', error);
      return Response.json(
        {
          success: false,
          error: 'Failed to fetch archive filters',
          details: error instanceof Error ? error.message : 'Unknown error',
          data: {
            categories: [],
            authors: [],
            date_ranges: [],
            statistics: {
              total_archived: 0,
              years_span: 0,
              oldest_post: null,
              newest_post: null,
              unique_authors: 0,
              unique_categories: 0
            },
            has_subscription: false
          }
        },
        { status: 500 }
      );
    }
  });
}