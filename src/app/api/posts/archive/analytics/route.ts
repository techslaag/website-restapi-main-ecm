import { NextRequest } from 'next/server';
import prisma from "@/lib/prisma";
import adminMiddleware from "@/lib/auth/adminMiddleware";

export const dynamic = "force-dynamic";

/**
 * GET /api/posts/archive/analytics
 * Returns detailed analytics about archived posts - admin only
 */
export async function GET(req: NextRequest) {
  return adminMiddleware(req, async (user) => {
    try {
      const currentDate = new Date();
      const oneWeekAgo = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const threeMonthsAgo = new Date(currentDate.getTime() - 90 * 24 * 60 * 60 * 1000);

      // Archive timing analysis
      const archiveTimingAnalysis = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_archived,
          AVG(DATEDIFF(archivedAt, post_date_gmt)) as avg_days_before_archive,
          MIN(DATEDIFF(archivedAt, post_date_gmt)) as min_days_before_archive,
          MAX(DATEDIFF(archivedAt, post_date_gmt)) as max_days_before_archive,
          COUNT(CASE WHEN archivedAt >= ${oneWeekAgo} THEN 1 END) as archived_last_week,
          COUNT(CASE WHEN archivedAt >= ${oneMonthAgo} THEN 1 END) as archived_last_month,
          COUNT(CASE WHEN archivedAt >= ${threeMonthsAgo} THEN 1 END) as archived_last_3_months
        FROM mod180_posts 
        WHERE post_type = 'post' 
        AND archived = TRUE 
        AND archivedAt IS NOT NULL
        AND post_date_gmt IS NOT NULL
      `;

      // Monthly archiving trends
      const monthlyTrends = await prisma.$queryRaw`
        SELECT 
          YEAR(archivedAt) as year,
          MONTH(archivedAt) as month,
          COUNT(*) as archived_count,
          AVG(DATEDIFF(archivedAt, post_date_gmt)) as avg_age_when_archived
        FROM mod180_posts 
        WHERE post_type = 'post' 
        AND archived = TRUE 
        AND archivedAt IS NOT NULL
        AND archivedAt >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY YEAR(archivedAt), MONTH(archivedAt)
        ORDER BY year DESC, month DESC
      `;

      // Category breakdown of archived posts
      const categoryBreakdown = await prisma.$queryRaw`
        SELECT 
          t.name as category_name,
          COUNT(p.ID) as archived_count,
          AVG(DATEDIFF(p.archivedAt, p.post_date_gmt)) as avg_age_when_archived,
          COUNT(CASE WHEN p.archivedAt >= ${oneMonthAgo} THEN 1 END) as archived_last_month
        FROM mod180_posts p
        INNER JOIN mod180_term_relationships tr ON p.ID = tr.object_id
        INNER JOIN mod180_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
        INNER JOIN mod180_terms t ON tt.term_id = t.term_id
        WHERE p.post_type = 'post'
        AND p.archived = TRUE
        AND p.archivedAt IS NOT NULL
        AND tt.taxonomy = 'category'
        GROUP BY t.term_id, t.name
        ORDER BY archived_count DESC
        LIMIT 20
      `;

      // Author breakdown of archived posts
      const authorBreakdown = await prisma.$queryRaw`
        SELECT 
          u.display_name,
          u.user_nicename,
          COUNT(p.ID) as archived_count,
          AVG(DATEDIFF(p.archivedAt, p.post_date_gmt)) as avg_age_when_archived,
          COUNT(CASE WHEN p.archivedAt >= ${oneMonthAgo} THEN 1 END) as archived_last_month
        FROM mod180_posts p
        INNER JOIN mod180_users u ON p.post_author = u.ID
        WHERE p.post_type = 'post'
        AND p.archived = TRUE
        AND p.archivedAt IS NOT NULL
        GROUP BY u.ID, u.display_name, u.user_nicename
        ORDER BY archived_count DESC
        LIMIT 15
      `;

      // Archive effectiveness (subscription vs free access patterns)
      const accessPatterns = await prisma.$queryRaw`
        SELECT 
          CASE 
            WHEN pm.meta_value = 'ecomembre' THEN 'Premium (Ecomembre)'
            WHEN pm.meta_value = 'premium' THEN 'Premium'
            WHEN pm.meta_value = 'gratuit' THEN 'Free'
            ELSE 'No Prestige Set'
          END as access_type,
          COUNT(p.ID) as post_count,
          AVG(DATEDIFF(p.archivedAt, p.post_date_gmt)) as avg_age_when_archived
        FROM mod180_posts p
        LEFT JOIN mod180_postmeta pm ON p.ID = pm.post_id AND pm.meta_key = 'post_prestige'
        WHERE p.post_type = 'post'
        AND p.archived = TRUE
        AND p.archivedAt IS NOT NULL
        GROUP BY 
          CASE 
            WHEN pm.meta_value = 'ecomembre' THEN 'Premium (Ecomembre)'
            WHEN pm.meta_value = 'premium' THEN 'Premium'
            WHEN pm.meta_value = 'gratuit' THEN 'Free'
            ELSE 'No Prestige Set'
          END
        ORDER BY post_count DESC
      `;

      // Archive storage impact
      const storageImpact = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_posts,
          COUNT(CASE WHEN archived = TRUE AND archivedAt IS NOT NULL THEN 1 END) as archived_posts,
          COUNT(CASE WHEN NOT (archived = TRUE AND archivedAt IS NOT NULL) THEN 1 END) as active_posts,
          ROUND(
            (COUNT(CASE WHEN archived = TRUE AND archivedAt IS NOT NULL THEN 1 END) * 100.0 / COUNT(*)), 
            2
          ) as archive_percentage,
          AVG(LENGTH(post_content)) as avg_content_length,
          AVG(CASE WHEN archived = TRUE AND archivedAt IS NOT NULL THEN LENGTH(post_content) END) as avg_archived_content_length,
          AVG(CASE WHEN NOT (archived = TRUE AND archivedAt IS NOT NULL) THEN LENGTH(post_content) END) as avg_active_content_length
        FROM mod180_posts 
        WHERE post_type = 'post' 
        AND post_status = 'publish'
      `;

      // Recent archiving activity
      const recentActivity = await prisma.$queryRaw`
        SELECT 
          p.ID,
          p.post_title,
          p.post_date_gmt,
          p.archivedAt,
          DATEDIFF(p.archivedAt, p.post_date_gmt) as days_before_archive,
          u.display_name as author_name,
          (SELECT GROUP_CONCAT(t.name SEPARATOR ', ') 
           FROM mod180_term_relationships tr 
           INNER JOIN mod180_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id 
           INNER JOIN mod180_terms t ON tt.term_id = t.term_id 
           WHERE tr.object_id = p.ID AND tt.taxonomy = 'category' 
           LIMIT 3) as categories
        FROM mod180_posts p
        INNER JOIN mod180_users u ON p.post_author = u.ID
        WHERE p.post_type = 'post'
        AND p.archived = TRUE
        AND p.archivedAt IS NOT NULL
        ORDER BY p.archivedAt DESC
        LIMIT 20
      `;

      return Response.json({
        success: true,
        data: {
          timing_analysis: Array.isArray(archiveTimingAnalysis) && archiveTimingAnalysis[0] ? {
            total_archived: Number(archiveTimingAnalysis[0].total_archived),
            avg_days_before_archive: Number(archiveTimingAnalysis[0].avg_days_before_archive?.toFixed(1)),
            min_days_before_archive: Number(archiveTimingAnalysis[0].min_days_before_archive),
            max_days_before_archive: Number(archiveTimingAnalysis[0].max_days_before_archive),
            archived_last_week: Number(archiveTimingAnalysis[0].archived_last_week),
            archived_last_month: Number(archiveTimingAnalysis[0].archived_last_month),
            archived_last_3_months: Number(archiveTimingAnalysis[0].archived_last_3_months)
          } : null,
          monthly_trends: Array.isArray(monthlyTrends) ? monthlyTrends.map((trend: any) => ({
            year: Number(trend.year),
            month: Number(trend.month),
            month_name: new Date(trend.year, trend.month - 1).toLocaleDateString('fr-FR', { month: 'long' }),
            archived_count: Number(trend.archived_count),
            avg_age_when_archived: Number(trend.avg_age_when_archived?.toFixed(1))
          })) : [],
          category_breakdown: Array.isArray(categoryBreakdown) ? categoryBreakdown.map((cat: any) => ({
            category_name: cat.category_name,
            archived_count: Number(cat.archived_count),
            avg_age_when_archived: Number(cat.avg_age_when_archived?.toFixed(1)),
            archived_last_month: Number(cat.archived_last_month)
          })) : [],
          author_breakdown: Array.isArray(authorBreakdown) ? authorBreakdown.map((author: any) => ({
            display_name: author.display_name,
            username: author.user_nicename,
            archived_count: Number(author.archived_count),
            avg_age_when_archived: Number(author.avg_age_when_archived?.toFixed(1)),
            archived_last_month: Number(author.archived_last_month)
          })) : [],
          access_patterns: Array.isArray(accessPatterns) ? accessPatterns.map((pattern: any) => ({
            access_type: pattern.access_type,
            post_count: Number(pattern.post_count),
            avg_age_when_archived: Number(pattern.avg_age_when_archived?.toFixed(1))
          })) : [],
          storage_impact: Array.isArray(storageImpact) && storageImpact[0] ? {
            total_posts: Number(storageImpact[0].total_posts),
            archived_posts: Number(storageImpact[0].archived_posts),
            active_posts: Number(storageImpact[0].active_posts),
            archive_percentage: Number(storageImpact[0].archive_percentage),
            avg_content_length: Number(storageImpact[0].avg_content_length?.toFixed(0)),
            avg_archived_content_length: Number(storageImpact[0].avg_archived_content_length?.toFixed(0)),
            avg_active_content_length: Number(storageImpact[0].avg_active_content_length?.toFixed(0))
          } : null,
          recent_activity: Array.isArray(recentActivity) ? recentActivity.map((activity: any) => ({
            id: Number(activity.ID),
            title: activity.post_title,
            publish_date: activity.post_date_gmt,
            archived_date: activity.archivedAt,
            days_before_archive: Number(activity.days_before_archive),
            author_name: activity.author_name,
            categories: activity.categories
          })) : [],
          generated_at: currentDate.toISOString()
        }
      });
    } catch (error) {
      console.error('Archive analytics API error:', error);
      return Response.json(
        {
          success: false,
          error: 'Failed to generate archive analytics',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  });
}