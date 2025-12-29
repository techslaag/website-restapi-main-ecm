import { NextRequest, NextResponse } from 'next/server';
import { ArchiveService } from '@/lib/services/archiveService';
import { serializeError } from 'serialize-error';

export const dynamic = "force-dynamic";
export const maxDuration = 1500; // 25 minutes (1500 seconds) - safer for external cron services

// GET /api/cron/archive-old-posts - Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'healthy', 
    service: 'archive-old-posts',
    version: '1.1',
    maxDuration: '25 minutes',
    timestamp: new Date().toISOString()
  });
}

// POST /api/cron/archive-old-posts - Cron job to archive old posts
export async function POST(req: NextRequest) {
  // Add timeout protection for external cron services
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error('Cron job timeout - aborting operation');
    controller.abort();
  }, 24 * 60 * 1000); // 24 minutes max to ensure we finish before external timeout
  const startTime = Date.now();
  const requestId = `cron-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  
  try {
    console.log(`[${requestId}] Archive cron job started (optimized for external cron services)`);
    
    // Check for query parameter to perform production fixes
    const url = new URL(req.url);
    const productionFix = url.searchParams.get('productionFix') === 'true';
    
    if (productionFix) {
      console.log(`[${requestId}] Special operation: Running production fixes...`);
      console.log(`[${requestId}] 1. Setting existing archived posts to premium`);
      console.log(`[${requestId}] 2. Unarchiving opinion posts`);
      console.log(`[${requestId}] 3. Unarchiving promotional content posts`);
      
      const result = await ArchiveService.runProductionFixes();
      
      const duration = Date.now() - startTime;
      const logMessage = `Production fixes completed: ${result.archivedSetToPremium} archived posts set to premium, ${result.opinionPostsUnarchived} opinion posts unarchived, ${result.promotionalPostsUnarchived} promotional posts unarchived, ${result.allOpinionPostsSetGratuit} opinion posts set gratuit, ${result.allPromotionalPostsSetGratuit} promotional posts set gratuit in ${duration}ms`;
      console.log(`[${requestId}] ${logMessage}`);
      
      return NextResponse.json({
        success: true,
        message: logMessage,
        operation: 'production_fixes',
        data: {
          archivedSetToPremium: result.archivedSetToPremium,
          opinionPostsUnarchived: result.opinionPostsUnarchived,
          promotionalPostsUnarchived: result.promotionalPostsUnarchived,
          allOpinionPostsSetGratuit: result.allOpinionPostsSetGratuit,
          allPromotionalPostsSetGratuit: result.allPromotionalPostsSetGratuit,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString(),
          requestId,
          sampleArchivedPosts: result.sampleArchivedPosts.slice(0, 3),
          sampleOpinionPosts: result.sampleOpinionPosts.slice(0, 3),
          samplePromotionalPosts: result.samplePromotionalPosts.slice(0, 3)
        }
      });
    }
    
    console.log(`[${requestId}] Starting optimized archive job for posts older than 45 days...`);
    console.log(`[${requestId}] Note: Opinion posts and promotional content posts will be excluded from archiving`);
    
    // Archive posts older than 45 days (excluding opinion posts and promotional content)
    const result = await ArchiveService.archiveOldPosts(45);
    
    const duration = Date.now() - startTime;
    const logMessage = `Archive job completed: ${result.count} posts archived in ${duration}ms`;
    console.log(`[${requestId}] ${logMessage}`);
    
    if (result.posts.length > 0) {
      console.log(`[${requestId}] Sample archived posts:`, result.posts.slice(0, 3));
    } else {
      console.log(`[${requestId}] No posts were archived (all current posts are either already archived, newer than 45 days, opinion posts, or promotional content)`);
    }

    // Log success metrics for monitoring
    console.log(`[${requestId}] METRICS: archived_count=${result.count}, duration=${duration}ms, timestamp=${new Date().toISOString()}`);

    return NextResponse.json({
      success: true,
      message: logMessage,
      data: {
        archivedCount: result.count,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        operation: 'scheduled_archive',
        requestId,
        samplePosts: result.posts.slice(0, 5)
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Archive cron job failed after ${duration}ms:`, error);
    
    // Check if this was a timeout abort
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[${requestId}] Operation was aborted due to timeout`);
    }
    
    // Log error metrics for monitoring
    console.error(`[${requestId}] ERROR_METRICS: operation=scheduled_archive, duration=${duration}ms, error=${error instanceof Error ? error.message : 'unknown'}, timestamp=${new Date().toISOString()}`);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Archive job failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
        operation: 'scheduled_archive',
        requestId,
        timestamp: new Date().toISOString(),
        timeout: error instanceof Error && error.name === 'AbortError',
        ...(process.env.NODE_ENV === "development" ? serializeError(error) : {})
      },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}