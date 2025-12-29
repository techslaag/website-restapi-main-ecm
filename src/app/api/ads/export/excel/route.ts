import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { extractQueryParams } from "@/lib/utils/index";
import { getPositionLabelFromWordPress } from "@/lib/utils/wordpressOptionsUtils";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

// Generate styled Excel file for ad analytics data
export async function GET(req: Request) {
  try {
    const queryParams = extractQueryParams(req);
    const { 
      ad_id, 
      start_date, 
      end_date,
    } = queryParams;

    // Build date filter
    let dateFilter: any = {};
    if (start_date || end_date) {
      dateFilter.timestamp = {};
      if (start_date) {
        dateFilter.timestamp.gte = new Date(start_date);
      }
      if (end_date) {
        // Add one day to include the end date fully
        const endDateObj = new Date(end_date);
        endDateObj.setDate(endDateObj.getDate() + 1);
        dateFilter.timestamp.lt = endDateObj;
      }
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      dateFilter.timestamp = { gte: thirtyDaysAgo };
    }

    // Build where clause
    let whereClause: any = { ...dateFilter };
    if (ad_id) {
      whereClause.ad_id = BigInt(ad_id);
    }

    // Get ad details if specific ad requested
    let adInfo = null;
    if (ad_id) {
      const ad = await prisma.mod180_posts.findUnique({
        where: { ID: BigInt(ad_id) },
        select: {
          ID: true,
          post_title: true,
          post_name: true,
          post_date: true,
          post_modified: true,
          meta: {
            select: {
              meta_key: true,
              meta_value: true
            },
            where: {
              meta_key: {
                in: ['position', 'redirect_url', 'advertiser', 'ad_type', 'image_url']
              }
            }
          }
        }
      });

      if (ad) {
        const meta = ad.meta.reduce((acc: Record<string, string>, m: any) => {
          if (m.meta_key) {
            acc[m.meta_key] = m.meta_value;
          }
          return acc;
        }, {} as Record<string, string>);

        const positionLabel = await getPositionLabelFromWordPress(meta.position || 'unknown');

        adInfo = {
          id: ad.ID.toString(),
          title: ad.post_title,
          position: positionLabel,
          position_key: meta.position || '',
          redirect_url: meta.redirect_url || '',
          advertiser: meta.advertiser || '',
          ad_type: meta.ad_type || '',
          image_url: meta.image_url || '',
          created_date: ad.post_date,
          modified_date: ad.post_modified
        };
      }
    }

    // Get analytics data - optimized queries
    const [insights, summaryStats, deviceStats, dailyStats, hourlyStats] = await Promise.all([
      // Raw insights (limited for performance)
      prisma.ad_insights.findMany({
        where: whereClause,
        select: {
          id: true,
          ad_id: true,
          event_type: true,
          user_ip: true,
          user_agent: true,
          referer_url: true,
          timestamp: true,
          user_id: true,
          session_id: true
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: 10000 // Limit to prevent memory issues
      }),
      
      // Summary statistics
      prisma.ad_insights.groupBy({
        by: ["event_type"],
        where: whereClause,
        _count: {
          id: true
        }
      }),
      
      // Event type statistics (device_type field doesn't exist in schema)
      prisma.ad_insights.groupBy({
        by: ["event_type"],
        where: whereClause,
        _count: {
          id: true
        }
      }),
      
      // Daily statistics
      prisma.$queryRaw`
        SELECT 
          DATE(timestamp) as date,
          event_type,
          COUNT(*) as count,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM ad_insights
        WHERE ${ad_id ? Prisma.sql`ad_id = ${BigInt(ad_id)}` : Prisma.sql`1=1`}
          ${start_date ? Prisma.sql`AND timestamp >= ${new Date(start_date)}` : Prisma.sql``}
          ${end_date ? Prisma.sql`AND timestamp < ${new Date(new Date(end_date).setDate(new Date(end_date).getDate() + 1))}` : Prisma.sql``}
        GROUP BY DATE(timestamp), event_type
        ORDER BY date DESC
      ` as Promise<Array<{date: Date, event_type: string, count: bigint, unique_sessions: bigint}>>,
      
      // Hourly distribution
      prisma.$queryRaw`
        SELECT 
          HOUR(timestamp) as hour,
          event_type,
          COUNT(*) as count
        FROM ad_insights
        WHERE ${ad_id ? Prisma.sql`ad_id = ${BigInt(ad_id)}` : Prisma.sql`1=1`}
          ${start_date ? Prisma.sql`AND timestamp >= ${new Date(start_date)}` : Prisma.sql``}
          ${end_date ? Prisma.sql`AND timestamp < ${new Date(new Date(end_date).setDate(new Date(end_date).getDate() + 1))}` : Prisma.sql``}
        GROUP BY HOUR(timestamp), event_type
        ORDER BY hour
      ` as Promise<Array<{hour: number, event_type: string, count: bigint}>>
    ]);

    // Process summary stats
    const stats = summaryStats.reduce((acc: Record<string, number>, stat: any) => {
      acc[stat.event_type] = stat._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Process event type stats (device stats not available in current schema)
    const eventStatsMap: Record<string, number> = {};
    deviceStats.forEach((stat: any) => {
      eventStatsMap[stat.event_type] = stat._count.id;
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Advertising Insights';
    workbook.created = new Date();

    // Define colors
    const primaryColor = '2271b1';
    const accentColor = 'F0B849';

    // Add Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary', {
      properties: { tabColor: { argb: primaryColor } }
    });

    // Title
    summarySheet.mergeCells('A1:F1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = adInfo ? `Analytics Report - ${adInfo.title}` : 'All Ads Analytics Report';
    titleCell.font = { name: 'Arial', size: 20, bold: true, color: { argb: primaryColor } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 40;

    // Export info
    let currentRow = 3;
    summarySheet.getCell(`A${currentRow}`).value = 'Export Date:';
    summarySheet.getCell(`B${currentRow}`).value = new Date().toLocaleString();
    currentRow++;
    
    summarySheet.getCell(`A${currentRow}`).value = 'Date Range:';
    summarySheet.getCell(`B${currentRow}`).value = `${dateFilter.timestamp?.gte?.toLocaleDateString() || 'All time'} - ${dateFilter.timestamp?.lt ? new Date(dateFilter.timestamp.lt.getTime() - 1).toLocaleDateString() : 'Present'}`;
    currentRow += 2;

    // Ad Information (if single ad)
    if (adInfo) {
      const infoStartRow = currentRow;
      summarySheet.getCell(`A${currentRow}`).value = 'Ad Information';
      summarySheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
      currentRow++;

      const adInfoData = [
        ['Ad ID:', adInfo.id],
        ['Title:', adInfo.title],
        ['Position:', adInfo.position],
        ['Advertiser:', adInfo.advertiser],
        ['Ad Type:', adInfo.ad_type],
        ['Created:', adInfo.created_date ? new Date(adInfo.created_date).toLocaleDateString() : 'Unknown'],
        ['Last Modified:', adInfo.modified_date ? new Date(adInfo.modified_date).toLocaleDateString() : 'Unknown'],
        ['Redirect URL:', adInfo.redirect_url]
      ];

      adInfoData.forEach(([label, value]) => {
        summarySheet.getCell(`A${currentRow}`).value = label;
        summarySheet.getCell(`A${currentRow}`).font = { bold: true };
        summarySheet.getCell(`B${currentRow}`).value = value;
        currentRow++;
      });

      // Style the info section
      for (let i = infoStartRow; i < currentRow; i++) {
        summarySheet.getRow(i).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F8F9FA' }
        };
      }
      currentRow++;
    }

    // Key Metrics
    summarySheet.getCell(`A${currentRow}`).value = 'Key Metrics';
    summarySheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
    currentRow++;

    const metricsData = [
      ['Total Impressions:', stats.impression || 0],
      ['Total Clicks:', stats.click || 0],
      ['Click-Through Rate:', stats.impression ? `${((stats.click || 0) / stats.impression * 100).toFixed(2)}%` : '0%'],
      ['Total Views:', stats.view || 0],
      ['Total Hovers:', stats.hover || 0],
      ['Engagement Rate:', stats.impression ? `${(((stats.click || 0) + (stats.view || 0) + (stats.hover || 0)) / stats.impression * 100).toFixed(2)}%` : '0%']
    ];

    metricsData.forEach(([label, value]) => {
      summarySheet.getCell(`A${currentRow}`).value = label;
      summarySheet.getCell(`A${currentRow}`).font = { bold: true };
      summarySheet.getCell(`B${currentRow}`).value = value;
      summarySheet.getCell(`B${currentRow}`).font = { size: 12, color: { argb: primaryColor } };
      currentRow++;
    });

    // Style columns
    summarySheet.getColumn('A').width = 25;
    summarySheet.getColumn('B').width = 30;

    // Add Event Performance Sheet (Device data not available)
    const eventSheet = workbook.addWorksheet('Event Performance', {
      properties: { tabColor: { argb: accentColor } }
    });

    eventSheet.columns = [
      { header: 'Event Type', key: 'event', width: 20 },
      { header: 'Count', key: 'count', width: 15 },
      { header: 'Percentage', key: 'percentage', width: 15 }
    ];

    // Style headers
    const eventHeaderRow = eventSheet.getRow(1);
    eventHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    eventHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: primaryColor }
    };
    eventHeaderRow.height = 30;
    eventHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Add event data
    const totalEvents = Object.values(eventStatsMap).reduce((sum, count) => sum + count, 0);
    Object.entries(eventStatsMap).forEach(([event, count]) => {
      eventSheet.addRow({
        event: event.charAt(0).toUpperCase() + event.slice(1),
        count,
        percentage: totalEvents > 0 ? ((count / totalEvents) * 100).toFixed(2) + '%' : '0%'
      });
    });

    // Add Daily Performance Sheet
    const dailySheet = workbook.addWorksheet('Daily Performance', {
      properties: { tabColor: { argb: '4AB866' } }
    });

    dailySheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Impressions', key: 'impressions', width: 15 },
      { header: 'Clicks', key: 'clicks', width: 15 },
      { header: 'CTR (%)', key: 'ctr', width: 15 },
      { header: 'Views', key: 'views', width: 15 },
      { header: 'Unique Sessions', key: 'sessions', width: 18 }
    ];

    // Style headers
    const dailyHeaderRow = dailySheet.getRow(1);
    dailyHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    dailyHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: primaryColor }
    };
    dailyHeaderRow.height = 30;
    dailyHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Process daily stats
    const dailyStatsMap: Record<string, any> = {};
    dailyStats.forEach((stat: any) => {
      const dateStr = new Date(stat.date).toLocaleDateString();
      if (!dailyStatsMap[dateStr]) {
        dailyStatsMap[dateStr] = {
          impressions: 0,
          clicks: 0,
          views: 0,
          unique_sessions: 0
        };
      }
      
      switch (stat.event_type) {
        case 'impression':
          dailyStatsMap[dateStr].impressions = Number(stat.count);
          dailyStatsMap[dateStr].unique_sessions = Math.max(dailyStatsMap[dateStr].unique_sessions, Number(stat.unique_sessions));
          break;
        case 'click':
          dailyStatsMap[dateStr].clicks = Number(stat.count);
          break;
        case 'view':
          dailyStatsMap[dateStr].views = Number(stat.count);
          break;
      }
    });

    // Add daily data sorted by date
    Object.entries(dailyStatsMap)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .forEach(([date, metrics]) => {
        dailySheet.addRow({
          date,
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          ctr: metrics.impressions > 0 ? ((metrics.clicks / metrics.impressions) * 100).toFixed(2) : '0.00',
          views: metrics.views,
          sessions: metrics.unique_sessions
        });
      });

    // Add Hourly Distribution Sheet
    const hourlySheet = workbook.addWorksheet('Hourly Distribution', {
      properties: { tabColor: { argb: 'D63638' } }
    });

    hourlySheet.columns = [
      { header: 'Hour', key: 'hour', width: 15 },
      { header: 'Impressions', key: 'impressions', width: 15 },
      { header: 'Clicks', key: 'clicks', width: 15 },
      { header: 'Views', key: 'views', width: 15 }
    ];

    // Style headers
    const hourlyHeaderRow = hourlySheet.getRow(1);
    hourlyHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    hourlyHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: primaryColor }
    };
    hourlyHeaderRow.height = 30;
    hourlyHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Process hourly stats
    const hourlyStatsMap: Record<number, any> = {};
    for (let i = 0; i < 24; i++) {
      hourlyStatsMap[i] = { impressions: 0, clicks: 0, views: 0 };
    }

    hourlyStats.forEach((stat: any) => {
      const hour = stat.hour;
      switch (stat.event_type) {
        case 'impression':
          hourlyStatsMap[hour].impressions = Number(stat.count);
          break;
        case 'click':
          hourlyStatsMap[hour].clicks = Number(stat.count);
          break;
        case 'view':
          hourlyStatsMap[hour].views = Number(stat.count);
          break;
      }
    });

    // Add hourly data
    Object.entries(hourlyStatsMap).forEach(([hour, metrics]) => {
      const hourNum = parseInt(hour);
      const hourStr = `${hourNum.toString().padStart(2, '0')}:00 - ${((hourNum + 1) % 24).toString().padStart(2, '0')}:00`;
      
      hourlySheet.addRow({
        hour: hourStr,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        views: metrics.views
      });
    });

    // Add Raw Data Sheet (limited)
    if (insights.length > 0) {
      const rawSheet = workbook.addWorksheet('Event Details', {
        properties: { tabColor: { argb: '666666' } }
      });

      rawSheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Time', key: 'time', width: 15 },
        { header: 'Event Type', key: 'event', width: 15 },
        { header: 'User Agent', key: 'userAgent', width: 25 },
        { header: 'Session ID', key: 'session', width: 20 },
        { header: 'IP Address', key: 'ip', width: 15 }
      ];

      // Style headers
      const rawHeaderRow = rawSheet.getRow(1);
      rawHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      rawHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '666666' }
      };
      rawHeaderRow.height = 30;
      rawHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };

      // Add raw data
      insights.forEach(insight => {
        const timestamp = insight.timestamp ? new Date(insight.timestamp) : new Date();
        
        rawSheet.addRow({
          date: timestamp.toLocaleDateString(),
          time: timestamp.toLocaleTimeString(),
          event: insight.event_type,
          userAgent: insight.user_agent || 'unknown',
          session: insight.session_id || 'anonymous',
          ip: insight.user_ip || 'unknown'
        });
      });

      // Add note about data limit
      if (insights.length >= 10000) {
        const lastRow = rawSheet.lastRow?.number || 1;
        rawSheet.getCell(`A${lastRow + 2}`).value = 'Note: Data limited to most recent 10,000 events';
        rawSheet.getCell(`A${lastRow + 2}`).font = { italic: true, color: { argb: '666666' } };
      }
    }

    // Apply conditional formatting and final styling to all sheets
    workbook.worksheets.forEach(sheet => {
      // Add borders to all data cells
      const lastRow = sheet.lastRow?.number || 1;
      const lastCol = sheet.columnCount;
      
      for (let row = 1; row <= lastRow; row++) {
        for (let col = 1; col <= lastCol; col++) {
          const cell = sheet.getRow(row).getCell(col);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      }

      // Zebra stripe data rows (skip header)
      for (let row = 2; row <= lastRow; row++) {
        if (row % 2 === 0) {
          sheet.getRow(row).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F5F5F5' }
          };
        }
      }
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = adInfo 
      ? `ad-${adInfo.id}-${adInfo.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${timestamp}.xlsx`
      : `all-ads-analytics-${timestamp}.xlsx`;

    // Return Excel file with proper headers
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Disposition'
      }
    });

  } catch (error) {
    console.error("Error generating Excel export:", error);
    return Response.json({ 
      success: false,
      error: 'Failed to generate export file',
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