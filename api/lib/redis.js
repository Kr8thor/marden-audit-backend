// Redis client for caching SEO audit results
// Uses Upstash Redis REST client for serverless compatibility
const axios = require('axios');

// Redis configuration from environment variables
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Check if Redis is configured
const isRedisConfigured = REDIS_URL && REDIS_TOKEN;

/**
 * Set a value in Redis with expiration
 * @param {string} key - Cache key
 * @param {object|string} value - Value to store (will be JSON stringified)
 * @param {number} expirationSeconds - Expiration time in seconds
 * @returns {Promise<boolean>} - Success status
 */
async function setCache(key, value, expirationSeconds = 3600) {
  try {
    if (!isRedisConfigured) {
      console.log('Redis not configured, skipping cache set');
      return false;
    }

    // Prepare value for storage
    const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
    
    // Create the Upstash Redis REST API URL for SET command with expiration
    const url = `${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(valueToStore)}?EX=${expirationSeconds}`;
    
    // Execute the Redis command
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`
      }
    });
    
    return response.data.result === 'OK';
  } catch (error) {
    console.error('Redis SET error:', error.message);
    return false;
  }
}

/**
 * Get a value from Redis
 * @param {string} key - Cache key
 * @returns {Promise<object|string|null>} - Retrieved value or null if not found
 */
async function getCache(key) {
  try {
    if (!isRedisConfigured) {
      console.log('Redis not configured, skipping cache get');
      return null;
    }
    
    // Create the Upstash Redis REST API URL for GET command
    const url = `${REDIS_URL}/get/${encodeURIComponent(key)}`;
    
    // Execute the Redis command
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`
      }
    });
    
    // Check if result is null (key not found)
    if (response.data.result === null) {
      return null;
    }
    
    // Try to parse the result as JSON, fallback to raw string
    try {
      return JSON.parse(response.data.result);
    } catch (e) {
      return response.data.result;
    }
  } catch (error) {
    console.error('Redis GET error:', error.message);
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
    
    // Execute the Redis command
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`
      }
    });
    
    return response.data.result > 0;
  } catch (error) {
    console.error('Redis DEL error:', error.message);
    return false;
  }
}

/**
 * Check Redis connection health
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
    
    // Execute the Redis command
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`
      },
      timeout: 2000 // Short timeout for health check
    });
    
    return response.data.result === 'PONG';
  } catch (error) {
    console.error('Redis health check error:', error.message);
    return false;
  }
}

/**
 * Generate a standardized cache key for SEO audits
 * @param {string} url - URL being audited
 * @param {object} options - Audit options
 * @returns {string} - Cache key
 */
function generateCacheKey(url, options = {}) {
  // Normalize URL for consistent caching
  const normalizedUrl = url.toLowerCase().replace(/\/$/, '');
  
  // Include options hash in cache key if options are provided
  let optionsStr = '';
  if (Object.keys(options).length > 0) {
    optionsStr = `-${JSON.stringify(options)}`;
  }
  
  return `seo-audit:${normalizedUrl}${optionsStr}`;
}

// Export Redis functions
module.exports = {
  setCache,
  getCache,
  deleteCache,
  checkHealth,
  generateCacheKey,
  isRedisConfigured
};