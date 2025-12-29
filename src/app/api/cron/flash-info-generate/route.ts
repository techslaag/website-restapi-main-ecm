import { NextRequest, NextResponse } from "next/server";
import { FlashInfoService } from "@/lib/services/flashInfoService";
import { serializeError } from 'serialize-error';

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 20 minutes - sufficient for Flash Info generation

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  description: string;
  version: string;
  maxDuration: string;
  timestamp: string;
  checks: {
    database: boolean;
    aiService: boolean;
    environment: boolean;
  };
  environment?: {
    googleAiConfigured: boolean;
    nodeEnv: string;
  };
}

// GET /api/cron/flash-info-generate - Enhanced health check endpoint
export async function GET(): Promise<NextResponse<HealthStatus>> {
  const healthStatus: HealthStatus = {
    status: 'healthy',
    service: 'flash-info-generate',
    description: 'Flash Info newsletter generation using Gemini AI',
    version: '1.1',
    maxDuration: '20 minutes',
    timestamp: new Date().toISOString(),
    checks: {
      database: false,
      aiService: false,
      environment: false
    }
  };

  try {
    // Check database connectivity
    const { connectionManager } = await import("@/lib/prisma");
    healthStatus.checks.database = await connectionManager.healthCheck();

    // Check AI service configuration
    healthStatus.checks.aiService = !!process.env.GOOGLE_AI_API_KEY;

    // Check environment
    healthStatus.checks.environment = true;
    
    if (process.env.NODE_ENV === 'development') {
      healthStatus.environment = {
        googleAiConfigured: healthStatus.checks.aiService,
        nodeEnv: process.env.NODE_ENV
      };
    }

    // Determine overall status
    const allChecks = Object.values(healthStatus.checks);
    if (allChecks.every(check => check)) {
      healthStatus.status = 'healthy';
    } else if (allChecks.some(check => check)) {
      healthStatus.status = 'degraded';
    } else {
      healthStatus.status = 'unhealthy';
    }

  } catch (error) {
    console.error('Health check failed:', error);
    healthStatus.status = 'unhealthy';
  }

  const statusCode = healthStatus.status === 'healthy' ? 200 : 
                    healthStatus.status === 'degraded' ? 200 : 503;

  return NextResponse.json(healthStatus, { status: statusCode });
}

// POST /api/cron/flash-info-generate - Enhanced cron job to generate Flash Info
export async function POST(req: NextRequest) {
  // Add timeout protection for external cron services
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error('Flash Info cron job timeout - aborting operation');
    controller.abort();
  }, 19 * 60 * 1000); // 19 minutes max to ensure we finish before external timeout
  
  const startTime = Date.now();
  const requestId = `flash-info-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  
  try {
    // Validate environment
    if (!process.env.GOOGLE_AI_API_KEY) {
      const error = 'GOOGLE_AI_API_KEY environment variable is not configured';
      console.error(`[${requestId}] ❌ Configuration error: ${error}`);
      return NextResponse.json(
        { 
          success: false,
          error: "Service misconfigured",
          details: "AI service configuration missing",
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 503 }
      );
    }

    console.log(`[${requestId}] 📰 Flash Info cron job started (optimized for external cron services)`);
    console.log(`[${requestId}] Environment: ${process.env.NODE_ENV}`);

    // Get and validate target date from query params
    const url = new URL(req.url);
    const dateParam = url.searchParams.get('date');
    const forceRegenerate = url.searchParams.get('force') === 'true';
    const skipCleanup = url.searchParams.get('skipCleanup') === 'true';
    
    let targetDate: Date;
    let isCustomDate = false;

    if (dateParam) {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateParam)) {
        console.error(`[${requestId}] Invalid date format: ${dateParam} (expected YYYY-MM-DD)`);
        return NextResponse.json(
          { 
            success: false,
            error: "Invalid date format",
            details: "Date must be in YYYY-MM-DD format",
            example: "2024-01-15",
            requestId,
            timestamp: new Date().toISOString()
          },
          { status: 400 }
        );
      }

      targetDate = new Date(dateParam + 'T00:00:00.000Z');
      if (isNaN(targetDate.getTime())) {
        console.error(`[${requestId}] Invalid date: ${dateParam}`);
        return NextResponse.json(
          { 
            success: false,
            error: "Invalid date",
            details: "The provided date is not valid",
            requestId,
            timestamp: new Date().toISOString()
          },
          { status: 400 }
        );
      }

      // Check if date is in the future
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (targetDate > today) {
        console.error(`[${requestId}] Future date not allowed: ${dateParam}`);
        return NextResponse.json(
          { 
            success: false,
            error: "Future date not allowed",
            details: "Flash Info can only be generated for past or current dates",
            requestId,
            timestamp: new Date().toISOString()
          },
          { status: 400 }
        );
      }

      isCustomDate = true;
      console.log(`[${requestId}] Generating Flash Info for custom date: ${targetDate.toISOString().split('T')[0]}`);
    } else {
      // Default: previous day
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      targetDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      console.log(`[${requestId}] Generating Flash Info for previous day: ${targetDate.toISOString().split('T')[0]}`);
    }

    // Enhanced pre-flight checks
    console.log(`[${requestId}] Performing pre-flight checks...`);
    
    // Check database connectivity
    try {
      const { connectionManager } = await import("@/lib/prisma");
      const dbHealthy = await connectionManager.healthCheck();
      if (!dbHealthy) {
        throw new Error('Database health check failed');
      }
      console.log(`[${requestId}] ✅ Database connectivity verified`);
    } catch (dbError) {
      console.error(`[${requestId}] ❌ Database check failed:`, dbError);
      return NextResponse.json(
        {
          success: false,
          error: "Database connectivity issue",
          details: "Unable to connect to database",
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 503 }
      );
    }

    // Generate Flash Info with enhanced parameters
    console.log(`[${requestId}] Starting Flash Info generation using Gemini AI...`);
    console.log(`[${requestId}] Parameters: force=${forceRegenerate}, skipCleanup=${skipCleanup}`);
    
    const generationResult = await FlashInfoService.generateFlashInfo(targetDate, forceRegenerate);

    // Clean up old Flash Info data (unless skipped)
    if (!skipCleanup) {
      console.log(`[${requestId}] Cleaning up old Flash Info data...`);
      await FlashInfoService.cleanupOldFlashInfo();
    } else {
      console.log(`[${requestId}] Skipping cleanup as requested`);
    }

    // Get final statistics
    const finalData = await FlashInfoService.getFlashInfoByDate(targetDate);

    const duration = Date.now() - startTime;
    const responseDate = targetDate.toISOString().split('T')[0];
    const logMessage = `Flash Info generation completed for ${responseDate} in ${duration}ms`;

    console.log(`[${requestId}] ✅ ${logMessage}`);
    console.log(`[${requestId}] Generated ${finalData.length} Flash Info groups`);

    // Enhanced success metrics
    const successMetrics = {
      operation: 'flash_info_generation',
      date: responseDate,
      duration,
      groupsGenerated: finalData.length,
      isCustomDate,
      forceRegenerate,
      skipCleanup,
      timestamp: new Date().toISOString()
    };

    console.log(`[${requestId}] METRICS:`, JSON.stringify(successMetrics));

    return NextResponse.json({
      success: true,
      message: logMessage,
      data: {
        date: responseDate,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        operation: 'flash_info_generation',
        requestId,
        sectionsGenerated: [
          'CE_QUIL_FAUT_SAVOIR',
          'CE_DONT_TOUT_LE_MONDE_PARLE',
          'A_LIRE_AUSSI'
        ],
        groupsGenerated: finalData.length,
        parameters: {
          isCustomDate,
          forceRegenerate,
          skipCleanup
        },
        summary: finalData.map((group) => ({
          groupNumber: group.groupNumber,
          sectionsCount: group.sectionsCount,
          totalArticles: group.totalArticles
        }))
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] ❌ Flash Info cron job failed after ${duration}ms:`, error);
    
    // Enhanced error classification
    let errorType = 'unknown';
    let errorDetails = 'Unknown error occurred';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorType = 'timeout';
        errorDetails = 'Operation was aborted due to timeout';
        console.error(`[${requestId}] Operation was aborted due to timeout`);
      } else if (error.message.includes('GOOGLE_AI_API_KEY')) {
        errorType = 'configuration';
        errorDetails = 'Google AI API key configuration issue';
      } else if (error.message.includes('database') || error.message.includes('prisma')) {
        errorType = 'database';
        errorDetails = 'Database operation failed';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorType = 'network';
        errorDetails = 'Network connectivity issue';
      } else {
        errorType = 'service';
        errorDetails = error.message;
      }
    }
    
    // Enhanced error metrics
    const errorMetrics = {
      operation: 'flash_info_generation',
      duration,
      errorType,
      error: error instanceof Error ? error.message : 'unknown',
      timestamp: new Date().toISOString()
    };

    console.error(`[${requestId}] ERROR_METRICS:`, JSON.stringify(errorMetrics));
    
    return NextResponse.json(
      {
        success: false,
        error: "Flash Info generation failed",
        errorType,
        details: errorDetails,
        duration: `${duration}ms`,
        operation: 'flash_info_generation',
        requestId,
        timestamp: new Date().toISOString(),
        timeout: errorType === 'timeout',
        ...(process.env.NODE_ENV === "development" ? { 
          debugInfo: serializeError(error),
          stack: error instanceof Error ? error.stack : undefined
        } : {})
      },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeoutId);
    console.log(`[${requestId}] Cron job execution completed`);
  }
}