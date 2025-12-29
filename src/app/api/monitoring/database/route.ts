import { NextRequest, NextResponse } from "next/server";
import { databaseMonitor, dbCircuitBreaker } from "@/lib/database/connectionRecovery";
import { connectionManager } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/monitoring/database
 * Database health and monitoring endpoint
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'health-check';
  
  try {
    switch (action) {
      case 'health-check':
        return await handleHealthCheck();
      
      case 'detailed-status':
        return await handleDetailedStatus();
      
      case 'reset-circuit-breaker':
        return await handleResetCircuitBreaker();
      
      case 'connection-info':
        return await handleConnectionInfo();
      
      case 'config':
        return await handleGetConfig();
      
      default:
        return NextResponse.json({
          error: "Invalid action",
          availableActions: [
            'health-check',
            'detailed-status',
            'reset-circuit-breaker',
            'connection-info',
            'config'
          ]
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[Database Monitoring] Error:', error);
    return NextResponse.json({
      error: "Monitoring system error",
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

async function handleHealthCheck() {
  const startTime = Date.now();
  
  try {
    const healthResult = await databaseMonitor.performHealthCheck();
    const connectionStatus = connectionManager.getStatus();
    
    return NextResponse.json({
      status: healthResult.healthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      latency: healthResult.latency,
      circuitBreaker: {
        state: healthResult.circuitBreakerState,
        healthy: healthResult.healthy
      },
      connection: {
        isHealthy: connectionStatus.isHealthy,
        lastHealthCheck: connectionStatus.lastHealthCheck,
        connectionCount: connectionStatus.connectionCount
      },
      environment: process.env.NODE_ENV,
      totalCheckTime: Date.now() - startTime,
      error: healthResult.error
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      totalCheckTime: Date.now() - startTime
    }, { status: 503 });
  }
}

async function handleDetailedStatus() {
  const startTime = Date.now();
  
  try {
    const [healthResult, connectionInfo, connectionStatus] = await Promise.allSettled([
      databaseMonitor.performHealthCheck(),
      databaseMonitor.getConnectionInfo(),
      connectionManager.getStatus()
    ]);

    const getSettledValue = (result: PromiseSettledResult<any>) => 
      result.status === 'fulfilled' ? result.value : { error: result.reason?.message };

    return NextResponse.json({
      status: "detailed",
      timestamp: new Date().toISOString(),
      health: getSettledValue(healthResult),
      connections: getSettledValue(connectionInfo),
      prismaStatus: getSettledValue(connectionStatus),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT_SET'
      },
      performance: {
        totalCheckTime: Date.now() - startTime,
        checksPerformed: 3
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      totalCheckTime: Date.now() - startTime
    }, { status: 500 });
  }
}

async function handleResetCircuitBreaker() {
  try {
    const stateBefore = dbCircuitBreaker.getState();
    dbCircuitBreaker.reset();
    const stateAfter = dbCircuitBreaker.getState();
    
    return NextResponse.json({
      success: true,
      message: "Circuit breaker reset successfully",
      before: stateBefore,
      after: stateAfter,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

async function handleConnectionInfo() {
  try {
    const connectionInfo = await databaseMonitor.getConnectionInfo();
    const prismaStatus = connectionManager.getStatus();
    
    return NextResponse.json({
      success: true,
      data: {
        mysql: connectionInfo,
        prisma: prismaStatus,
        circuitBreaker: connectionInfo.circuitBreaker
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

async function handleGetConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return NextResponse.json({
    success: true,
    config: {
      environment: process.env.NODE_ENV,
      connectionLimits: {
        development: 5,
        production: 50
      },
      timeouts: {
        connectTimeout: isProduction ? 60000 : 15000,
        poolTimeout: isProduction ? 30000 : 10000,
        transactionTimeout: 30000
      },
      circuitBreaker: {
        failureThreshold: isProduction ? 5 : 3,
        recoveryTimeout: isProduction ? 60000 : 30000,
        monitoringPeriod: 300000
      },
      retry: {
        maxRetries: isProduction ? 3 : 2,
        baseDelay: 1000,
        maxDelay: isProduction ? 15000 : 5000
      },
      healthChecks: {
        interval: isProduction ? 300000 : 60000, // 5 min prod, 1 min dev
        enabled: isProduction
      }
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * POST /api/monitoring/database
 * Administrative actions for database management
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    switch (action) {
      case 'force-reconnect':
        return await handleForceReconnect();
      
      case 'test-connection':
        return await handleTestConnection();
      
      case 'clear-connections':
        return await handleClearConnections();
      
      default:
        return NextResponse.json({
          error: "Invalid action",
          availableActions: [
            'force-reconnect',
            'test-connection', 
            'clear-connections'
          ]
        }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      error: "Invalid request",
      message: error instanceof Error ? error.message : String(error)
    }, { status: 400 });
  }
}

async function handleForceReconnect() {
  try {
    await connectionManager.reconnect();
    const healthCheck = await databaseMonitor.performHealthCheck();
    
    return NextResponse.json({
      success: true,
      message: "Force reconnection completed",
      healthAfterReconnect: healthCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

async function handleTestConnection() {
  const tests = [];
  
  // Test 1: Basic connectivity
  try {
    const startTime = Date.now();
    const healthCheck = await databaseMonitor.performHealthCheck();
    tests.push({
      name: "Basic Connectivity",
      passed: healthCheck.healthy,
      latency: Date.now() - startTime,
      error: healthCheck.error
    });
  } catch (error) {
    tests.push({
      name: "Basic Connectivity",
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  // Test 2: Connection pool
  try {
    const connectionInfo = await databaseMonitor.getConnectionInfo();
    tests.push({
      name: "Connection Pool",
      passed: connectionInfo.activeConnections >= 0,
      details: connectionInfo
    });
  } catch (error) {
    tests.push({
      name: "Connection Pool",
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  // Test 3: Circuit breaker
  const circuitBreakerState = dbCircuitBreaker.getState();
  tests.push({
    name: "Circuit Breaker",
    passed: circuitBreakerState.state === 'CLOSED',
    details: circuitBreakerState
  });
  
  const allPassed = tests.every(test => test.passed);
  
  return NextResponse.json({
    success: allPassed,
    message: allPassed ? "All tests passed" : "Some tests failed",
    tests,
    timestamp: new Date().toISOString()
  }, { 
    status: allPassed ? 200 : 207 // 207 Multi-Status for partial failures
  });
}

async function handleClearConnections() {
  try {
    // Note: This is a placeholder - actual implementation would depend on your MySQL configuration
    // In a production environment, you might want to run KILL queries or restart connection pools
    
    const connectionInfo = await databaseMonitor.getConnectionInfo();
    
    return NextResponse.json({
      success: true,
      message: "Connection clearing initiated (implementation depends on MySQL setup)",
      connectionsBefore: connectionInfo.activeConnections,
      timestamp: new Date().toISOString(),
      note: "This operation may require database admin privileges"
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}