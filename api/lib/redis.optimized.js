// Optimized Redis client for caching SEO audit results
// Designed to handle high load scenarios with fallbacks
const { Redis } = require('@upstash/redis');
const fetch = require('node-fetch');

// Redis configuration from environment variables
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Check if Redis is configured
const isRedisConfigured = REDIS_URL && REDIS_TOKEN;

// Initialize Redis client
let redisClient = null;
if (isRedisConfigured) {
  try {
    redisClient = new Redis({
      url: REDIS_URL,
      token: REDIS_TOKEN,
      timeoutMs: 2000 // 2 second timeout
    });
    console.log('Upstash Redis client initialized');
  } catch (error) {
    console.error('Error initializing Upstash Redis client:', error);
  }
}

// Default cache TTL (24 hours)
const DEFAULT_CACHE_TTL = 86400;

// Memory cache for quick access
const memoryCache = new Map();

// Track Redis request statistics for monitoring
const stats = {
  setRequests: 0,
  setSuccesses: 0,
  getRequests: 0,
  getSuccesses: 0,
  errors: 0,
  lastError: null,
  lastErrorTime: null
};

/**
 * Set a value in Redis with expiration, optimized for background operation
 * @param {string} key - Cache key
 * @param {object|string} value - Value to store (will be JSON stringified)
 * @param {number} expirationSeconds - Expiration time in seconds
 * @returns {Promise<boolean>} - Success status
 */
async function setCache(key, value, expirationSeconds = DEFAULT_CACHE_TTL) {
  stats.setRequests++;
  
  try {
    if (!isRedisConfigured || !redisClient) {
      console.log('Redis not configured, skipping cache set');
      return false;
    }

    // Prepare value for storage
    const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
    
    // Set with expiration in Redis
    const result = await redisClient.set(key, valueToStore, { ex: expirationSeconds });
    
    const success = result === 'OK';
    
    if (success) {
      stats.setSuccesses++;
      
      // Also update memory cache for faster retrieval
      memoryCache.set(key, {
        data: value,
        timestamp: Date.now()
      });
      
      // Limit memory cache size
      if (memoryCache.size > 100) {
        // Remove oldest keys
        const oldestKey = Array.from(memoryCache.keys())[0];
        memoryCache.delete(oldestKey);
      }
    }
    
    return success;
  } catch (error) {
    console.error('Redis SET error:', error.message);
    stats.errors++;
    stats.lastError = error.message;
    stats.lastErrorTime = new Date().toISOString();
    return false;
  }
}

/**
 * Get a value from Redis with timeout
 * @param {string} key - Cache key
 * @returns {Promise<object|string|null>} - Retrieved value or null if not found
 */
async function getCache(key) {
  stats.getRequests++;
  
  try {
    // Check memory cache first
    const memoryCached = memoryCache.get(key);
    if (memoryCached && Date.now() - memoryCached.timestamp < 3600000) { // 1 hour memory cache
      console.log(`Memory cache hit for ${key}`);
      return memoryCached.data;
    }
    
    if (!isRedisConfigured || !redisClient) {
      console.log('Redis not configured, skipping cache get');
      return null;
    }
    
    // Get from Redis
    const result = await redisClient.get(key);
    
    // Check if result is null (key not found)
    if (result === null) {
      return null;
    }
    
    stats.getSuccesses++;
    
    // Try to parse the result as JSON, fallback to raw string
    let parsedResult;
    try {
      parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
    } catch (e) {
      parsedResult = result;
    }
    
    // Update memory cache
    memoryCache.set(key, {
      data: parsedResult,
      timestamp: Date.now()
    });
    
    return parsedResult;
  } catch (error) {
    console.error('Redis GET error:', error.message);
    stats.errors++;
    stats.lastError = error.message;
    stats.lastErrorTime = new Date().toISOString();
    return null;
  }
}

/**
 * Delete a value from Redis
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} - Success status
 */
async function deleteCache(key) {
  try {
    // Always remove from memory cache
    memoryCache.delete(key);
    
    if (!isRedisConfigured || !redisClient) {
      console.log('Redis not configured, skipping cache delete');
      return false;
    }
    
    // Delete from Redis
    const result = await redisClient.del(key);
    return result > 0;
  } catch (error) {
    console.error('Redis DEL error:', error.message);
    stats.errors++;
    stats.lastError = error.message;
    stats.lastErrorTime = new Date().toISOString();
    return false;
  }
}

/**
 * Check Redis connection health with timeout
 * @returns {Promise<boolean>} - Redis health status
 */
async function checkHealth() {
  try {
    if (!isRedisConfigured || !redisClient) {
      console.log('Redis not configured, health check returning false');
      return false;
    }
    
    // Ping Redis
    const result = await redisClient.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis health check error:', error.message);
    stats.errors++;
    stats.lastError = error.message;
    stats.lastErrorTime = new Date().toISOString();
    return false;
  }
}

/**
 * Generate a standardized cache key for SEO audits
 * @param {string} url - URL being audited
 * @param {object} options - Audit options (ignored to reduce complexity)
 * @returns {string} - Cache key
 */
function generateCacheKey(url, options = {}) {
  // Simplified key generation - just use normalized URL
  // Ignore options to reduce key complexity
  const normalizedUrl = url.toLowerCase().replace(/\/$/, '');
  return `seo-audit:${normalizedUrl}`;
}

/**
 * Get Redis statistics
 * @returns {object} - Redis usage statistics
 */
function getStats() {
  return {
    ...stats,
    successRate: {
      set: stats.setRequests ? (stats.setSuccesses / stats.setRequests * 100).toFixed(2) + '%' : 'N/A',
      get: stats.getRequests ? (stats.getSuccesses / stats.getRequests * 100).toFixed(2) + '%' : 'N/A'
    },
    isRedisConfigured,
    cacheSize: {
      memory: memoryCache.size
    }
  };
}

// Export Redis functions
module.exports = {
  setCache,
  getCache,
  deleteCache,
  checkHealth,
  generateCacheKey,
  getStats,
  isRedisConfigured,
  DEFAULT_CACHE_TTL,
  memoryCache
};
