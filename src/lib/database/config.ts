/**
 * Environment-specific database configuration
 * Optimizes connection settings for development vs production environments
 */

export interface DatabaseConfig {
  connectionLimit: number;
  connectTimeout: number;
  acquireTimeout: number;
  queryTimeout: number;
  idleTimeout: number;
  maxLifetime: number;
  healthCheckInterval: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface TransactionConfig {
  maxWait: number;
  timeout: number;
  isolationLevel: 'ReadCommitted' | 'ReadUncommitted' | 'RepeatableRead' | 'Serializable';
}

/**
 * Get optimized database configuration based on environment
 */
export function getDatabaseConfig(): DatabaseConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTesting = process.env.NODE_ENV === 'test';

  // Base configuration
  const baseConfig: DatabaseConfig = {
    connectionLimit: 20,
    connectTimeout: 30000,    // 30 seconds
    acquireTimeout: 30000,    // 30 seconds  
    queryTimeout: 30000,      // 30 seconds
    idleTimeout: 600000,      // 10 minutes
    maxLifetime: 3600000,     // 1 hour
    healthCheckInterval: 300000, // 5 minutes
    retryAttempts: 3,
    retryDelay: 1000,        // 1 second
  };

  // Production configuration - optimized for high concurrency
  if (isProduction) {
    return {
      ...baseConfig,
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '50'),
      connectTimeout: 60000,    // 60 seconds - longer for production stability
      acquireTimeout: 60000,    // 60 seconds
      queryTimeout: 60000,      // 60 seconds - handle complex queries
      idleTimeout: 600000,      // 10 minutes
      maxLifetime: 3600000,     // 1 hour
      healthCheckInterval: 300000, // 5 minutes
      retryAttempts: 5,         // More retries in production
      retryDelay: 2000,         // 2 seconds
    };
  }

  // Development configuration - optimized for hot-reload and rapid iteration
  if (isDevelopment) {
    return {
      ...baseConfig,
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '5'),
      connectTimeout: 15000,    // 15 seconds - faster feedback
      acquireTimeout: 15000,    // 15 seconds
      queryTimeout: 30000,      // 30 seconds
      idleTimeout: 180000,      // 3 minutes - shorter for dev
      maxLifetime: 1800000,     // 30 minutes
      healthCheckInterval: 60000, // 1 minute - more frequent in dev
      retryAttempts: 2,         // Fewer retries for faster failure feedback
      retryDelay: 500,          // 500ms
    };
  }

  // Testing configuration - minimal resources, fast execution
  if (isTesting) {
    return {
      ...baseConfig,
      connectionLimit: 3,
      connectTimeout: 10000,    // 10 seconds
      acquireTimeout: 10000,    // 10 seconds
      queryTimeout: 15000,      // 15 seconds
      idleTimeout: 60000,       // 1 minute
      maxLifetime: 300000,      // 5 minutes
      healthCheckInterval: 0,   // Disabled for tests
      retryAttempts: 1,         // No retries in tests
      retryDelay: 100,          // 100ms
    };
  }

  return baseConfig;
}

/**
 * Get transaction configuration based on environment
 */
export function getTransactionConfig(): TransactionConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Base configuration
  const baseConfig: TransactionConfig = {
    maxWait: 30000,           // 30 seconds to acquire transaction
    timeout: 60000,           // 60 seconds max transaction time
    isolationLevel: 'ReadCommitted',
  };

  if (isProduction) {
    return {
      ...baseConfig,
      maxWait: 45000,         // 45 seconds - longer wait in production
      timeout: 120000,        // 2 minutes - handle complex operations
      isolationLevel: 'ReadCommitted',
    };
  }

  if (isDevelopment) {
    return {
      ...baseConfig,
      maxWait: 15000,         // 15 seconds - faster feedback
      timeout: 60000,         // 1 minute
      isolationLevel: 'ReadCommitted',
    };
  }

  return baseConfig;
}

/**
 * Build optimized database URL with connection parameters
 */
export function buildOptimizedDatabaseUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    const config = getDatabaseConfig();
    
    // Remove existing connection parameters to avoid conflicts
    const paramsToRemove = [
      'connection_limit',
      'pool_timeout', 
      'connect_timeout',
      'socket_timeout',
      'interactive_timeout',
      'wait_timeout'
    ];
    
    paramsToRemove.forEach(param => url.searchParams.delete(param));
    
    // Add optimized parameters
    url.searchParams.set('connection_limit', config.connectionLimit.toString());
    url.searchParams.set('pool_timeout', Math.floor(config.acquireTimeout / 1000).toString());
    url.searchParams.set('connect_timeout', Math.floor(config.connectTimeout / 1000).toString());
    
    // MySQL specific optimizations
    if (url.protocol.includes('mysql')) {
      // Connection timeout in seconds
      url.searchParams.set('connectTimeout', Math.floor(config.connectTimeout / 1000).toString());
      
      // Socket timeout for query execution
      url.searchParams.set('socketTimeout', Math.floor(config.queryTimeout / 1000).toString());
      
      // MySQL session timeouts
      url.searchParams.set('acquireTimeout', Math.floor(config.acquireTimeout / 1000).toString());
      
      // Charset and collation for better performance
      if (!url.searchParams.has('charset')) {
        url.searchParams.set('charset', 'utf8mb4');
      }
      
      // SSL configuration for production
      if (process.env.NODE_ENV === 'production' && !url.searchParams.has('sslaccept')) {
        url.searchParams.set('sslaccept', 'strict');
      }
    }
    
    return url.toString();
  } catch (error) {
    console.error('Failed to build optimized database URL:', error);
    return baseUrl; // Return original URL on error
  }
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL environment variable is required');
  }
  
  const config = getDatabaseConfig();
  
  if (config.connectionLimit < 1) {
    errors.push('Connection limit must be at least 1');
  }
  
  if (config.connectTimeout < 1000) {
    errors.push('Connect timeout must be at least 1000ms');
  }
  
  if (config.queryTimeout < 1000) {
    errors.push('Query timeout must be at least 1000ms');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get database monitoring configuration
 */
export function getMonitoringConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    enableQueryLogging: !isProduction,
    enableErrorLogging: true,
    enableWarningLogging: true,
    enablePerformanceMonitoring: true,
    slowQueryThreshold: isProduction ? 2000 : 1000, // 2s in prod, 1s in dev
    connectionPoolMonitoring: true,
    healthCheckEnabled: isProduction,
  };
}

/**
 * Database configuration summary for logging
 */
export function getConfigSummary() {
  const config = getDatabaseConfig();
  const transactionConfig = getTransactionConfig();
  const validation = validateDatabaseConfig();
  
  return {
    environment: process.env.NODE_ENV,
    database: {
      connectionLimit: config.connectionLimit,
      timeouts: {
        connect: config.connectTimeout,
        acquire: config.acquireTimeout,
        query: config.queryTimeout,
      },
      poolManagement: {
        idleTimeout: config.idleTimeout,
        maxLifetime: config.maxLifetime,
      },
    },
    transactions: {
      maxWait: transactionConfig.maxWait,
      timeout: transactionConfig.timeout,
      isolationLevel: transactionConfig.isolationLevel,
    },
    validation,
  };
}