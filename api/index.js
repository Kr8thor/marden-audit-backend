// Optimized API endpoint for SEO audit to reduce CPU usage on Railway
const axios = require('axios');
const cheerio = require('cheerio');
const url = require('url');

// Import Redis client for caching if configured
let redis;
try {
  redis = require('./lib/redis.optimized');
  console.log('Redis client imported successfully');
} catch (error) {
  console.warn('Redis client not available:', error.message);
  // Provide fallback empty implementation
  redis = {
    getCache: async () => null,
    setCache: async () => false,
    deleteCache: async () => false,
    checkHealth: async () => false,
    generateCacheKey: () => '',
    isRedisConfigured: false
  };
}

// Import site audit functionality
let siteAudit;
try {
  siteAudit = require('../src/crawler/site-audit');
  console.log('Site audit module imported successfully');
} catch (error) {
  console.warn('Site audit module not available:', error.message);
  // Provide fallback empty implementation
  siteAudit = {
    performSiteAudit: async (url) => ({
      url,
      error: {
        message: 'Site audit module not available'
      },
      status: 'error',
      timestamp: new Date().toISOString()
    })
  };
}

// Global request concurrency control
const CONCURRENCY_LIMIT = 2; // Only process two requests at a time
let activeRequests = 0;
const pendingRequests = [];

// Simple memory-based cache for emergency fallback
const memoryCache = new Map();

// Add CORS headers
function addCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');  // Allow all origins
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin, Cache-Control');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Log CORS headers for debugging
  console.log('CORS headers added - allowing all origins including localhost:8081');
}

// Request throttling middleware
function limitConcurrency(req, res, next) {
  if (activeRequests >= CONCURRENCY_LIMIT) {
    // Too many requests, queue this one or return cached/simplified result
    const { url: requestUrl } = req.body || req.query || {};
    
    if (requestUrl) {
      // Try memory cache for quick response under load
      const cacheKey = `mem:${requestUrl.toLowerCase()}`;
      const cachedResult = memoryCache.get(cacheKey);
      
      if (cachedResult) {
        console.log(`Memory cache hit for ${requestUrl} under high load`);
        return res.status(200).json({
          status: 'ok',
          message: 'SEO analysis retrieved from memory cache (high load mode)',
          url: requestUrl,
          cached: true,
          cachedAt: cachedResult.timestamp,
          data: cachedResult.data
        });
      }
    }
    
    // If we reached maximum requests, return simplified response instead of queueing
    if (pendingRequests.length >= 5) {
      console.log(`Too many pending requests (${pendingRequests.length}), returning simplified response`);
      return res.status(200).json({
        status: 'ok',
        message: 'Server is under high load. Basic analysis only.',
        data: {
          url: requestUrl,
          score: 50,
          status: 'partial',
          message: 'Server is currently experiencing high demand. Try again later for full analysis.',
          criticalIssuesCount: 0,
          totalIssuesCount: 0,
          categories: {
            metadata: { score: 50, issues: [] },
            content: { score: 50, issues: [] },
            technical: { score: 50, issues: [] },
            userExperience: { score: 50, issues: [] }
          },
          recommendations: []
        },
        simplified: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // Queue the request
    pendingRequests.push({ req, res, next });
    console.log(`Request queued. Active: ${activeRequests}, Pending: ${pendingRequests.length}`);
    return;
  }
  
  activeRequests++;
  console.log(`Processing request. Active: ${activeRequests}, Pending: ${pendingRequests.length}`);
  next();
}

// Release a request slot and process next in queue
function releaseRequest() {
  activeRequests--;
  
  // Process next request if any
  if (pendingRequests.length > 0 && activeRequests < CONCURRENCY_LIMIT) {
    const { req, res, next } = pendingRequests.shift();
    activeRequests++;
    next();
  }
  
  console.log(`Request completed. Active: ${activeRequests}, Pending: ${pendingRequests.length}`);
}

// Simple timeout Promise
function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Normalize URL to ensure proper format
 */
function normalizeUrl(url) {
  if (!url) return '';
  
  // Trim whitespace
  let normalizedUrl = url.trim();
  
  // Remove trailing slashes for consistency
  while (normalizedUrl.endsWith('/')) {
    normalizedUrl = normalizedUrl.slice(0, -1);
  }
  
  // Ensure proper protocol
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  
  return normalizedUrl;
}

/**
 * Handler for health check endpoint
 */
async function handleHealthCheck(req, res) {
  try {
    // Check Redis health if configured
    let redisStatus = {
      status: 'disabled',
      message: 'Redis not configured'
    };
    
    if (redis.isRedisConfigured) {
      try {
        const redisHealth = await Promise.race([
          redis.checkHealth(),
          timeout(1000).then(() => false)
        ]);
        
        redisStatus = {
          status: redisHealth ? 'ok' : 'error',
          message: redisHealth ? 'Connected' : 'Connection timed out'
        };
      } catch (error) {
        redisStatus = {
          status: 'error',
          message: `Connection failed: ${error.message}`
        };
      }
    }
    
    return res.status(200).json({
      status: 'ok',
      version: 'v2.1',
      message: 'Marden SEO Audit API is operational',
      components: {
        api: {
          status: 'ok'
        },
        redis: redisStatus
      },
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
      },
      concurrency: {
        activeRequests,
        pendingRequests: pendingRequests.length,
        limit: CONCURRENCY_LIMIT
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Perform lightweight SEO analysis
 * Optimized for CPU efficiency
 */
async function analyzeSeoLightweight(urlString) {
  try {
    console.log(`Lightweight analysis for ${urlString}`);
    const startTime = Date.now();
    
    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let response;
    try {
      response = await fetch(urlString, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MardenSEOAuditBot/1.0)',
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      return {
        url: urlString,
        status: "error",
        message: `Failed to fetch URL: ${error.message}`,
        score: 0
      };
    }
    
    if (!response.ok) {
      return {
        url: urlString,
        status: "error",
        statusCode: response.status,
        message: `Failed to fetch URL: ${response.statusText}`,
        score: 0
      };
    }
    
    const html = await response.text();
    
    // Lightweight parsing with regex instead of full DOM parsing
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) 
                          || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';
    
    // Count headings without full DOM parsing
    const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
    const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
    const imgCount = (html.match(/<img[^>]*>/gi) || []).length;
    const imgWithoutAlt = (html.match(/<img[^>]*(?!alt=)[^>]*>/gi) || []).length;
    
    // Calculate score based on basic factors
    let score = 70; // Start with a default score
    let issues = [];
    
    if (!title) {
      score -= 20;
      issues.push("Missing title tag");
    } else if (title.length < 20 || title.length > 60) {
      score -= 10;
      issues.push("Title length not optimal (20-60 chars recommended)");
    }
    
    if (!description) {
      score -= 15;
      issues.push("Missing meta description");
    } else if (description.length < 50 || description.length > 160) {
      score -= 5;
      issues.push("Description length not optimal (50-160 chars recommended)");
    }
    
    if (h1Count === 0) {
      score -= 15;
      issues.push("Missing H1 heading");
    } else if (h1Count > 1) {
      score -= 5;
      issues.push("Multiple H1 headings detected");
    }
    
    if (imgWithoutAlt > 0) {
      score -= Math.min(10, imgWithoutAlt);
      issues.push("Images missing alt text");
    }
    
    // Ensure score is in range
    score = Math.max(0, Math.min(100, score));
    
    // Determine status
    let status = 'good';
    if (score < 50) {
      status = 'poor';
    } else if (score < 80) {
      status = 'needs_improvement';
    }
    
    // Calculate performance
    const endTime = Date.now();
    const analysisTime = endTime - startTime;
    
    return {
      url: urlString,
      score,
      status,
      criticalIssuesCount: issues.length,
      totalIssuesCount: issues.length,
      categories: {
        metadata: { 
          score: title && description ? 80 : 50, 
          issues: [] 
        },
        content: { 
          score: h1Count === 1 ? 80 : 50, 
          issues: [] 
        },
        technical: { 
          score: 70, 
          issues: [] 
        },
        userExperience: { 
          score: 70, 
          issues: [] 
        }
      },
      recommendations: issues.map(issue => ({
        priority: 'medium',
        description: issue
      })),
      pageData: {
        title: {
          text: title,
          length: title.length
        },
        metaDescription: {
          text: description,
          length: description.length
        },
        headings: {
          h1Count,
          h2Count
        },
        images: {
          total: imgCount,
          withoutAlt: imgWithoutAlt
        }
      },
      metadata: {
        analysisTime,
        htmlSize: `${Math.round(html.length / 1024)} KB`
      },
      analyzedAt: new Date().toISOString(),
      analyzedWith: 'lightweight'
    };
  } catch (error) {
    console.error(`Error in lightweight analysis: ${error.message}`);
    return {
      url: urlString,
      score: 0,
      status: 'error',
      error: {
        message: `Analysis error: ${error.message}`
      },
      analyzedAt: new Date().toISOString()
    };
  }
}

/**
 * Handle site-wide audit endpoint
 */
async function handleSiteAudit(req, res) {
  try {
    // Extract request body (support both POST and GET methods)
    let requestUrl;
    let options = {};
    
    if (req.method === 'POST') {
      let requestBody = req.body;
      
      // Parse body if it's a string
      if (typeof requestBody === 'string') {
        try {
          requestBody = JSON.parse(requestBody);
        } catch (e) {
          releaseRequest();
          return res.status(400).json({
            status: 'error',
            message: 'Invalid JSON in request body',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      requestUrl = requestBody.url;
      
      // Extract options if provided
      if (requestBody.options) {
        options = requestBody.options;
      } else {
        // Extract common options directly from request body
        if (requestBody.maxPages) options.maxPages = requestBody.maxPages;
        if (requestBody.maxDepth) options.maxDepth = requestBody.maxDepth;
        if (requestBody.respectRobots !== undefined) options.respectRobots = requestBody.respectRobots;
        if (requestBody.customPages) options.customPages = requestBody.customPages;
      }
    } else if (req.method === 'GET') {
      requestUrl = req.query.url;
      
      // Extract options from query parameters
      if (req.query.maxPages) options.maxPages = parseInt(req.query.maxPages, 10);
      if (req.query.maxDepth) options.maxDepth = parseInt(req.query.maxDepth, 10);
      if (req.query.respectRobots !== undefined) options.respectRobots = req.query.respectRobots === 'true';
    }
    
    if (!requestUrl) {
      releaseRequest();
      return res.status(400).json({
        status: 'error',
        message: 'URL is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Normalize and validate URL format
    const normalizedUrl = normalizeUrl(requestUrl);
    try {
      new URL(normalizedUrl);
    } catch (error) {
      releaseRequest();
      return res.status(400).json({
        status: 'error',
        message: 'Invalid URL provided',
        timestamp: new Date().toISOString()
      });
    }
    
    // Apply defaults and limits to options
    options.maxPages = Math.min(options.maxPages || 10, 20); // Limit to 20 pages max
    options.maxDepth = Math.min(options.maxDepth || 2, 3);   // Limit to depth 3 max
    options.cacheResults = true; // Always use cache when available
    options.concurrency = 1;     // Limit to 1 concurrent request for Railway
    options.timeout = 10000;     // 10 second timeout per request
    
    console.log(`Performing site audit for ${normalizedUrl} with options:`, options);
    
    // Check memory cache first (ultra-fast, no Redis)
    const memoryCacheKey = `mem:site-audit:${normalizedUrl.toLowerCase()}`;
    const memoryCached = memoryCache.get(memoryCacheKey);
    
    if (memoryCached && Date.now() - memoryCached.timestamp < 3600000) { // 1 hour memory cache
      console.log(`Memory cache hit for site audit: ${normalizedUrl}`);
      releaseRequest();
      return res.status(200).json({
        status: 'ok',
        message: 'Site audit retrieved from memory cache',
        url: normalizedUrl,
        cached: true,
        cachedAt: new Date(memoryCached.timestamp).toISOString(),
        data: memoryCached.data,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check Redis cache with timeout
    let siteAuditResults;
    let cached = false;
    let cachedAt = null;
    
    if (redis.isRedisConfigured) {
      try {
        const cacheKey = `site-audit:${normalizedUrl.toLowerCase()}`;
        console.log(`Checking Redis cache for site audit: ${cacheKey}`);
        
        // Try to get cached results with timeout
        const cachedResults = await Promise.race([
          redis.getCache(cacheKey),
          timeout(1000).then(() => null) // 1 second timeout for Redis
        ]);
        
        if (cachedResults) {
          console.log(`Redis cache hit for site audit: ${normalizedUrl}`);
          siteAuditResults = cachedResults.data;
          cached = true;
          cachedAt = cachedResults.timestamp;
          
          // Update memory cache
          memoryCache.set(memoryCacheKey, {
            data: siteAuditResults,
            timestamp: Date.now()
          });
        } else {
          console.log(`Redis cache miss for site audit: ${normalizedUrl}`);
        }
      } catch (error) {
        console.error('Error checking Redis cache for site audit:', error);
      }
    }
    
    // If no cached results, perform site audit
    if (!siteAuditResults) {
      try {
        console.log(`Performing site audit for ${normalizedUrl}`);
        
        // Import the streamlined site-audit module
        const siteAudit = require('./site-audit');
        
        // Use the streamlined module directly
        siteAuditResults = await siteAudit.crawlAndAnalyzeSite(normalizedUrl, options);
        
        // Cache successful results if no error
        if (!siteAuditResults.error) {
          // Always update memory cache
          memoryCache.set(memoryCacheKey, {
            data: siteAuditResults,
            timestamp: Date.now()
          });
          
          // Try to update Redis cache without waiting
          if (redis.isRedisConfigured) {
            try {
              const cacheKey = `site-audit:${normalizedUrl.toLowerCase()}`;
              // Don't await - run in background
              redis.setCache(cacheKey, {
                data: siteAuditResults,
                timestamp: new Date().toISOString()
              }, 86400).catch(err => console.error('Background Redis caching error:', err));
            } catch (error) {
              console.error('Error caching site audit results:', error);
            }
          }
        }
      } catch (error) {
        console.error(`Error performing site audit for ${normalizedUrl}:`, error);
        releaseRequest();
        return res.status(500).json({
          status: 'error',
          message: `Failed to perform site audit: ${error.message}`,
          url: normalizedUrl,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Check if site audit resulted in an error
    if (siteAuditResults.error) {
      releaseRequest();
      return res.status(200).json({
        status: 'error',
        message: siteAuditResults.error.message || 'Site audit encountered an error',
        url: normalizedUrl,
        cached: false,
        timestamp: new Date().toISOString(),
        data: {
          error: siteAuditResults.error
        }
      });
    }
    
    // Return successful site audit results
    releaseRequest();
    return res.status(200).json({
      status: 'ok',
      message: cached ? 'Site audit retrieved from cache' : 'Site audit completed',
      url: normalizedUrl,
      cached,
      cachedAt,
      timestamp: new Date().toISOString(),
      data: siteAuditResults
    });
  } catch (error) {
    console.error('Error in site audit handler:', error);
    releaseRequest();
    return res.status(500).json({
      status: 'error',
      message: 'Failed to perform site audit',
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle SEO analysis endpoint with CPU optimization
 */
async function handleSeoAnalyze(req, res) {
  try {
    // Extract request body (support both POST and GET methods)
    let requestUrl;
    
    if (req.method === 'POST') {
      let requestBody = req.body;
      
      // Parse body if it's a string
      if (typeof requestBody === 'string') {
        try {
          requestBody = JSON.parse(requestBody);
        } catch (e) {
          releaseRequest();
          return res.status(400).json({
            status: 'error',
            message: 'Invalid JSON in request body',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      requestUrl = requestBody.url;
    } else if (req.method === 'GET') {
      requestUrl = req.query.url;
    }
    
    if (!requestUrl) {
      releaseRequest();
      return res.status(400).json({
        status: 'error',
        message: 'URL is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Normalize and validate URL format
    const normalizedUrl = normalizeUrl(requestUrl);
    try {
      new URL(normalizedUrl);
    } catch (error) {
      releaseRequest();
      return res.status(400).json({
        status: 'error',
        message: 'Invalid URL provided',
        timestamp: new Date().toISOString()
      });
    }
    
    // Memory cache check (ultra-fast, no Redis)
    const memoryCacheKey = `mem:${normalizedUrl.toLowerCase()}`;
    const memoryCached = memoryCache.get(memoryCacheKey);
    
    if (memoryCached && Date.now() - memoryCached.timestamp < 3600000) { // 1 hour memory cache
      console.log(`Memory cache hit for ${normalizedUrl}`);
      releaseRequest();
      return res.status(200).json({
        status: 'ok',
        message: 'SEO analysis retrieved from memory cache',
        url: normalizedUrl,
        cached: true,
        cachedAt: new Date(memoryCached.timestamp).toISOString(),
        data: memoryCached.data,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check Redis cache with timeout
    let analysisResults;
    let cached = false;
    let cachedAt = null;
    
    if (redis.isRedisConfigured) {
      try {
        const cacheKey = redis.generateCacheKey(normalizedUrl);
        console.log(`Checking Redis cache for key: ${cacheKey}`);
        
        // Try to get cached results with timeout
        const cachedResults = await Promise.race([
          redis.getCache(cacheKey),
          timeout(500).then(() => null) // 500ms timeout for Redis
        ]);
        
        if (cachedResults) {
          console.log(`Redis cache hit for ${normalizedUrl}`);
          analysisResults = cachedResults.data;
          cached = true;
          cachedAt = cachedResults.timestamp;
          
          // Update memory cache
          memoryCache.set(memoryCacheKey, {
            data: analysisResults,
            timestamp: Date.now()
          });
          
          // Limit memory cache size
          if (memoryCache.size > 100) {
            // Delete oldest entries
            const keys = [...memoryCache.keys()];
            for (let i = 0; i < 20; i++) {
              memoryCache.delete(keys[i]);
            }
          }
        } else {
          console.log(`Redis cache miss for ${normalizedUrl}`);
        }
      } catch (error) {
        console.error('Error checking Redis cache:', error);
        // Continue with analysis if cache check fails
      }
    }
    
    // If no cached results, perform analysis
    if (!analysisResults) {
      // Get current server load
      const memUsage = process.memoryUsage();
      const highLoad = (memUsage.heapUsed / memUsage.heapTotal > 0.7) || (activeRequests >= CONCURRENCY_LIMIT - 1);
      
      console.log(`Performing ${highLoad ? 'lightweight' : 'standard'} analysis for ${normalizedUrl}`);
      
      // Use lightweight analysis under high load
      analysisResults = await analyzeSeoLightweight(normalizedUrl);
      
      // Cache successful results
      if (!analysisResults.error) {
        // Always update memory cache
        memoryCache.set(memoryCacheKey, {
          data: analysisResults,
          timestamp: Date.now()
        });
        
        // Try to update Redis cache without waiting
        if (redis.isRedisConfigured) {
          try {
            const cacheKey = redis.generateCacheKey(normalizedUrl);
            // Don't await - run in background
            redis.setCache(cacheKey, {
              data: analysisResults,
              timestamp: new Date().toISOString()
            }, 86400).catch(err => console.error('Background Redis caching error:', err));
          } catch (error) {
            console.error('Error caching results:', error);
          }
        }
      }
    }
    
    // Check if analysis resulted in an error
    if (analysisResults.error) {
      releaseRequest();
      return res.status(200).json({
        status: 'error',
        message: analysisResults.error.message || 'SEO analysis encountered an error',
        url: normalizedUrl,
        cached: false,
        timestamp: new Date().toISOString(),
        data: analysisResults
      });
    }
    
    // Return successful analysis results
    releaseRequest();
    return res.status(200).json({
      status: 'ok',
      message: cached ? 'SEO analysis retrieved from cache' : 'SEO analysis completed',
      url: normalizedUrl,
      cached,
      cachedAt,
      timestamp: new Date().toISOString(),
      data: analysisResults
    });
  } catch (error) {
    console.error('Error performing SEO analysis:', error);
    releaseRequest();
    return res.status(500).json({
      status: 'error',
      message: 'Failed to perform SEO analysis',
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Main API handler - Unified to avoid exceeding serverless function limits
 * Routes to different handlers based on the URL path and method
 * Optimized for Railway deployment
 */
module.exports = async (req, res) => {
  // Add CORS headers
  addCorsHeaders(res);
  
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Parse URL and extract path
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    
    console.log(`Request received for path: ${path}, method: ${req.method}`);
    
    // Get the query parameters
    req.query = parsedUrl.query;
    
    // Global request timeout (shorter for Railway)
    const requestTimeout = setTimeout(() => {
      console.error(`Request timeout for ${path}`);
      if (!res.headersSent) {
        return res.status(503).json({
          status: 'error',
          message: 'Request timed out',
          path,
          timestamp: new Date().toISOString()
        });
      }
    }, 15000); // 15 second timeout
    
    // Clear the timeout when the request completes
    const clearRequestTimeout = () => {
      clearTimeout(requestTimeout);
    };
    
    // Add event listeners to clear the timeout
    res.on('finish', clearRequestTimeout);
    res.on('close', clearRequestTimeout);
    
    // Simplified routing based on path and HTTP method
    // Health check endpoint - no concurrency limit for status checks
    if (path === '/v2/health' || path === '/health' || path === '/api/health') {
      return await handleHealthCheck(req, res);
    }
    
    // For all other endpoints, apply concurrency limiting
    // SEO analysis endpoint
    if (path === '/v2/seo-analyze' || path === '/seo-analyze' || path === '/api/real-seo-audit' || 
        path === '/api/seo-analyze' || path === '/analyze') {
      return await limitConcurrency(req, res, async () => {
        await handleSeoAnalyze(req, res);
      });
    }
    
    // Site audit endpoint
    if (path === '/site-audit' || path === '/v2/site-audit' || path === '/api/site-audit') {
      return await limitConcurrency(req, res, async () => {
        await handleSiteAudit(req, res);
      });
    }
    
    // Basic audit endpoint - also route to the same analyzer with concurrency limiting
    if (path === '/basic-audit' || path === '/api/basic-audit') {
      // Extract URL from query parameters for GET requests
      if (req.method === 'GET' && req.query.url) {
        req.body = { url: req.query.url };
      }
      return await limitConcurrency(req, res, async () => {
        await handleSeoAnalyze(req, res);
      });
    }
    
    // Root path - return API info (no concurrency limit needed)
    if (path === '/' || path === '' || path === '/api' || path === '/api/') {
      return res.status(200).json({
        status: 'ok',
        message: 'Marden SEO Audit API',
        version: 'v2.1',
        endpoints: {
          health: '/api/health',
          basic: '/api/basic-audit?url=example.com',
          seo: '/api/seo-analyze?url=example.com',
          siteAudit: '/api/site-audit'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Return 404 for unmatched routes
    return res.status(404).json({
      status: 'error',
      message: `Endpoint not found: ${path}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error handling request:', error);
    
    // Provide safe error response with appropriate status code
    const statusCode = error.statusCode || 500;
    
    return res.status(statusCode).json({
      status: 'error',
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
      timestamp: new Date().toISOString()
    });
  }
};