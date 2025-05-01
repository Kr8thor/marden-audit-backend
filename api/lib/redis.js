// Redis connection for serverless functions
const { Redis } = require('@upstash/redis');

// Initialize Redis client with proper error handling
let redis;

try {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  console.log("Redis client initialized successfully");
} catch (error) {
  console.error("Failed to initialize Redis client:", error);
  // Create a mock client for development
  if (process.env.NODE_ENV === 'development') {
    console.warn("Using in-memory mock Redis store for development");
    
    const mockStore = new Map();
    
    redis = {
      get: async (key) => {
        console.log(`[Mock Redis] GET ${key}`);
        return mockStore.get(key);
      },
      set: async (key, value, options) => {
        console.log(`[Mock Redis] SET ${key}`);
        mockStore.set(key, value);
        return 'OK';
      },
      del: async (...keys) => {
        console.log(`[Mock Redis] DEL ${keys.join(', ')}`);
        let count = 0;
        for (const key of keys) {
          if (mockStore.delete(key)) count++;
        }
        return count;
      },
      lpush: async (key, ...elements) => {
        console.log(`[Mock Redis] LPUSH ${key}`);
        if (!mockStore.has(key)) mockStore.set(key, []);
        const list = mockStore.get(key);
        list.unshift(...elements);
        return list.length;
      },
      rpush: async (key, ...elements) => {
        console.log(`[Mock Redis] RPUSH ${key}`);
        if (!mockStore.has(key)) mockStore.set(key, []);
        const list = mockStore.get(key);
        list.push(...elements);
        return list.length;
      },
      lrange: async (key, start, end) => {
        console.log(`[Mock Redis] LRANGE ${key} ${start} ${end}`);
        if (!mockStore.has(key)) return [];
        const list = mockStore.get(key);
        return list.slice(start, end + 1);
      },
      rpop: async (key, count = 1) => {
        console.log(`[Mock Redis] RPOP ${key}`);
        if (!mockStore.has(key)) return null;
        const list = mockStore.get(key);
        if (list.length === 0) return null;
        if (count === 1) return list.pop();
        return list.splice(-Math.min(count, list.length));
      },
      lpop: async (key, count = 1) => {
        console.log(`[Mock Redis] LPOP ${key}`);
        if (!mockStore.has(key)) return null;
        const list = mockStore.get(key);
        if (list.length === 0) return null;
        if (count === 1) return list.shift();
        return list.splice(0, Math.min(count, list.length));
      },
      expire: async (key, seconds) => {
        console.log(`[Mock Redis] EXPIRE ${key} ${seconds}`);
        return mockStore.has(key) ? 1 : 0;
      }
    };
  }
}

// Key prefixes following the standardization rule
const keys = {
  jobPrefix: 'job:',
  queueKey: 'audit:queue',
  processingQueueKey: 'audit:processing',
  cachePrefix: 'audit:',
};

// Cache TTL (1 hour default as per requirements)
const DEFAULT_CACHE_TTL = 3600;

/**
 * Get a job by ID
 * @param {string} jobId - Job ID
 * @returns {Promise<object|null>} Job data or null if not found
 */
async function getJob(jobId) {
  try {
    const jobKey = `${keys.jobPrefix}${jobId}`;
    const jobData = await redis.get(jobKey);
    return jobData ? JSON.parse(jobData) : null;
  } catch (error) {
    console.error(`Error getting job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Create a new job
 * @param {object} jobData - Job data
 * @returns {Promise<string>} Job ID
 */
async function createJob(jobData) {
  try {
    // Generate a timestamp-based ID if none provided
    const jobId = jobData.id || `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const jobKey = `${keys.jobPrefix}${jobId}`;
    
    // Create job object
    const job = {
      id: jobId,
      status: 'queued',
      progress: 0,
      created: Date.now(),
      updated: Date.now(),
      ...jobData,
    };
    
    // Save the job data
    await redis.set(jobKey, JSON.stringify(job));
    
    // Add the job ID to the queue
    await redis.rpush(keys.queueKey, jobId);
    
    return jobId;
  } catch (error) {
    console.error('Error creating job:', error);
    throw error;
  }
}

/**
 * Update a job
 * @param {string} jobId - Job ID
 * @param {object} updatedData - Updated job data
 * @returns {Promise<boolean>} Success status
 */
async function updateJob(jobId, updatedData) {
  try {
    const jobKey = `${keys.jobPrefix}${jobId}`;
    
    // Get current job data
    const jobData = await redis.get(jobKey);
    if (!jobData) {
      return false;
    }
    
    // Parse and update
    const job = JSON.parse(jobData);
    const updatedJob = {
      ...job,
      ...updatedData,
      updated: Date.now(),
    };
    
    // Save updated job
    await redis.set(jobKey, JSON.stringify(updatedJob));
    return true;
  } catch (error) {
    console.error(`Error updating job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Get next job from queue
 * @returns {Promise<string|null>} Job ID or null if queue is empty
 */
async function getNextJob() {
  try {
    const jobId = await redis.lpop(keys.queueKey);
    if (jobId) {
      // Move to processing queue
      await redis.rpush(keys.processingQueueKey, jobId);
    }
    return jobId;
  } catch (error) {
    console.error('Error getting next job:', error);
    throw error;
  }
}

/**
 * Get cached data with standardized key format
 * @param {string} type - Cache type (e.g., 'site', 'page')
 * @param {string} url - URL to normalize
 * @param {string} [keyword] - Optional keyword
 * @returns {Promise<object|null>} Cached data or null
 */
async function getCachedData(type, url, keyword = '') {
  try {
    const normalizedUrl = normalizeUrl(url);
    const cacheKey = `${keys.cachePrefix}${type}:${normalizedUrl}${keyword ? `:${keyword}` : ''}`;
    
    const cachedData = await redis.get(cacheKey);
    return cachedData ? JSON.parse(cachedData) : null;
  } catch (error) {
    console.error(`Error getting cached data for ${url}:`, error);
    // Graceful degradation - return null on cache error
    return null;
  }
}

/**
 * Cache data with standardized key format
 * @param {string} type - Cache type (e.g., 'site', 'page')
 * @param {string} url - URL to normalize
 * @param {object} data - Data to cache
 * @param {number} [ttl] - TTL in seconds (default: 1 hour)
 * @param {string} [keyword] - Optional keyword
 * @returns {Promise<boolean>} Success status
 */
async function cacheData(type, url, data, ttl = DEFAULT_CACHE_TTL, keyword = '') {
  try {
    const normalizedUrl = normalizeUrl(url);
    const cacheKey = `${keys.cachePrefix}${type}:${normalizedUrl}${keyword ? `:${keyword}` : ''}`;
    
    // Add cached flag as per requirements
    const cachedData = {
      ...data,
      cached: true,
      cachedAt: Date.now(),
    };
    
    // Keep cached items under 1MB for best performance (per requirement #11)
    const serialized = JSON.stringify(cachedData);
    if (serialized.length > 1000000) {
      console.warn(`Cached data for ${cacheKey} exceeds 1MB limit`);
    }
    
    // Cache with TTL
    await redis.set(cacheKey, serialized, { ex: ttl });
    return true;
  } catch (error) {
    console.error(`Error caching data for ${url}:`, error);
    return false;
  }
}

/**
 * Normalize URL for consistent cache keys
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
  if (!url) return '';
  
  try {
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const urlObj = new URL(url);
    
    // Remove trailing slash, 'www.', and convert to lowercase
    let normalized = urlObj.hostname.replace(/^www\./, '').toLowerCase();
    
    // Append path (without trailing slash)
    if (urlObj.pathname && urlObj.pathname !== '/') {
      normalized += urlObj.pathname.replace(/\/$/, '');
    }
    
    return normalized;
  } catch (error) {
    console.error(`Error normalizing URL ${url}:`, error);
    // Return original URL if parsing fails
    return url.toLowerCase();
  }
}

module.exports = {
  redis,
  keys,
  getJob,
  createJob,
  updateJob,
  getNextJob,
  getCachedData,
  cacheData,
  normalizeUrl,
  DEFAULT_CACHE_TTL
};