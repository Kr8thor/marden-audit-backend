// Optimized Redis client for caching SEO audit results
// Designed to handle high load scenarios with fallbacks
const axios = require('axios');

// Redis configuration from environment variables
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Check if Redis is configured
const isRedisConfigured = REDIS_URL && REDIS_TOKEN;

// Default cache TTL (24 hours)
const DEFAULT_CACHE_TTL = 86400;

// Request timeout for Redis operations (ms)
const REDIS_TIMEOUT = 2000;

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
async function setCache(key, value, expirationSeconds = 3600) {
  stats.setRequests++;
  
  try {
    if (!isRedisConfigured) {
      console.log('Redis not configured, skipping cache set');
      return false;
    }

    // Prepare value for storage
    const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
    
    // Create the Upstash Redis REST API URL for SET command with expiration
    const url = `${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(valueToStore)}?EX=${expirationSeconds}`;
    
    // Execute the Redis command with timeout
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`
      },
      timeout: REDIS_TIMEOUT
    });
    
    const success = response.data.result === 'OK';
    
    if (success) {
      stats.setSuccesses++;
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
    if (!isRedisConfigured) {
      console.log('Redis not configured, skipping cache get');
      return null;
    }
    
    // Create the Upstash Redis REST API URL for GET command
    const url = `${REDIS_URL}/get/${encodeURIComponent(key)}`;
    
    // Execute the Redis command with timeout
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`
      },
      timeout: REDIS_TIMEOUT
    });
    
    // Check if result is null (key not found)
    if (response.data.result === null) {
      return null;
    }
    
    stats.getSuccesses++;
    
    // Try to parse the result as JSON, fallback to raw string
    try {
      return JSON.parse(response.data.result);
    } catch (e) {
      return response.data.result;
    }
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
    if (!isRedisConfigured) {
      console.log('Redis not configured, skipping cache delete');
      return false;
    }
    
    // Create the Upstash Redis REST API URL for DEL command
    const url = `${REDIS_URL}/del/${encodeURIComponent(key)}`;
    
    // Execute the Redis command with timeout
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`
      },
      timeout: REDIS_TIMEOUT
    });
    
    return response.data.result > 0;
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
    if (!isRedisConfigured) {
      console.log('Redis not configured, health check returning false');
      return false;
    }
    
    // Create the Upstash Redis REST API URL for PING command
    const url = `${REDIS_URL}/ping`;
    
    // Execute the Redis command with timeout
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`
      },
      timeout: REDIS_TIMEOUT
    });
    
    return response.data.result === 'PONG';
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
    isRedisConfigured
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
  DEFAULT_CACHE_TTL
};
