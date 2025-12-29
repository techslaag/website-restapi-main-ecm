import { PrismaClient } from "@prisma/client";

/**
 * Enhanced Prisma client with connection pooling, monitoring, and error recovery
 * Addresses production connection issues and development hot-reload problems
 */

interface ExtendedPrismaClient extends PrismaClient {
  _connectionCount?: number;
  _lastHealthCheck?: Date;
  _isHealthy?: boolean;
}

// Connection pool configuration based on environment
const getConnectionConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    // Connection pool settings
    connectionLimit: isProduction ? 50 : 10, // Higher limit for production
    
    // Timeout configurations (in milliseconds)
    connectTimeout: 60000,      // 60 seconds to establish connection
    acquireTimeout: 60000,      // 60 seconds to acquire connection from pool
    timeout: 60000,             // 60 seconds for query execution
    
    // Pool management
    idleTimeout: 600000,        // 10 minutes before closing idle connections
    maxLifetime: 3600000,       // 1 hour max connection lifetime
    
    // Development specific settings
    ...(isDevelopment && {
      connectionLimit: 5,       // Lower limit for development
      idleTimeout: 300000,      // 5 minutes for dev
    }),
  };
};

// Enhanced logging configuration
const getLogConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    return ['error', 'warn'] as any;
  }
  
  return ['info', 'warn', 'error'] as any;
};

// Build optimized database URL with connection parameters
const buildDatabaseUrl = () => {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  // Parse existing URL to avoid duplicating parameters
  const url = new URL(baseUrl);
  const config = getConnectionConfig();
  
  // Add connection pool parameters if not already present
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', config.connectionLimit.toString());
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', Math.floor(config.acquireTimeout / 1000).toString());
  }
  if (!url.searchParams.has('connect_timeout')) {
    url.searchParams.set('connect_timeout', Math.floor(config.connectTimeout / 1000).toString());
  }
  
  return url.toString();
};

const prismaClientSingleton = (): ExtendedPrismaClient => {
  const config = getConnectionConfig();
  
  const client = new PrismaClient({
    datasourceUrl: buildDatabaseUrl(),
    log: getLogConfig(),
    
    // Error formatting for better debugging
    errorFormat: process.env.NODE_ENV === 'production' ? 'minimal' : 'pretty',
    
    // Transactional configuration
    transactionOptions: {
      maxWait: 30000,     // 30 seconds max wait for transaction
      timeout: 60000,     // 60 seconds max transaction time
      isolationLevel: 'ReadCommitted', // Prevent long-running locks
    },
  }) as ExtendedPrismaClient;
  
  // Initialize client metadata
  client._connectionCount = 0;
  client._lastHealthCheck = new Date();
  client._isHealthy = true;
  
  // Note: Event listeners removed due to TypeScript compatibility issues
  // Database monitoring is handled by the connectionRecovery module
  
  return client;
};

// Global singleton pattern for development hot-reload prevention
declare const globalThis: {
  prismaGlobal: ExtendedPrismaClient;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

// Only assign to global in development to prevent multiple instances during hot-reload
if (process.env.NODE_ENV === 'development') {
  globalThis.prismaGlobal = prisma;
}

/**
 * Enhanced connection management utilities
 */
export const connectionManager = {
  // Health check function
  async healthCheck(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      (prisma as ExtendedPrismaClient)._isHealthy = true;
      (prisma as ExtendedPrismaClient)._lastHealthCheck = new Date();
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      (prisma as ExtendedPrismaClient)._isHealthy = false;
      return false;
    }
  },
  
  // Get connection status
  getStatus() {
    const client = prisma as ExtendedPrismaClient;
    return {
      isHealthy: client._isHealthy ?? false,
      lastHealthCheck: client._lastHealthCheck,
      connectionCount: client._connectionCount ?? 0,
    };
  },
  
  // Force reconnection
  async reconnect(): Promise<void> {
    try {
      await prisma.$disconnect();
      await prisma.$connect();
      console.log('✅ Database reconnection successful');
    } catch (error) {
      console.error('❌ Database reconnection failed:', error);
      throw error;
    }
  },
  
  // Graceful shutdown
  async shutdown(): Promise<void> {
    try {
      await prisma.$disconnect();
      console.log('✅ Database connections closed gracefully');
    } catch (error) {
      console.error('❌ Error during database shutdown:', error);
    }
  }
};

// Automatic health checks in production
if (process.env.NODE_ENV === 'production') {
  // Health check every 5 minutes
  setInterval(async () => {
    try {
      await connectionManager.healthCheck();
    } catch (error) {
      console.error('Scheduled health check failed:', error);
    }
  }, 5 * 60 * 1000);
}

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await connectionManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await connectionManager.shutdown();
  process.exit(0);
});

export default prisma;
export { prisma };
