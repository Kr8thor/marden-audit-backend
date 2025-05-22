// Import required dependencies
const redis = require('./lib/redis.optimized');

// Simple URL normalization function
function normalizeUrl(url) {
  if (!url) return '';
  
  let normalized = url.trim();
  
  // Ensure proper protocol
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  
  return normalized;
}

// FORCE REBUILD - Version 2.2.0

// Import handlers for different endpoints
const handleHealthCheck = require('./health');
const { handleSeoAnalyze } = require('./site-audit');
const handleSiteAudit = require('./enhanced-site-audit');
const handleEnhancedSiteCrawl = require('./enhanced-site-crawl');

// Setup concurrency control
let activeRequests = 0;
const MAX_CONCURRENCY = process.env.MAX_CONCURRENCY ? parseInt(process.env.MAX_CONCURRENCY, 10) : 3;
const requestQueue = [];

// Middleware for limiting concurrent requests
function limitConcurrency(req, res, next) {
  if (activeRequests < MAX_CONCURRENCY) {
    activeRequests++;
    next();
  } else {
    // Queue the request
    requestQueue.push(next);
    
    // Add timeout to prevent indefinite waiting
    setTimeout(() => {
      const index = requestQueue.indexOf(next);
      if (index !== -1) {
        requestQueue.splice(index, 1);
        res.status(503).json({
          status: 'busy',
          message: 'Server is currently handling too many requests. Please try again later.',
          timestamp: new Date().toISOString()
        });
      }
    }, 30000); // 30 second timeout
  }
}

// Release a request slot and process next in queue
function releaseRequest() {
  if (requestQueue.length > 0) {
    const next = requestQueue.shift();
    next();
  } else {
    activeRequests--;
  }
}

// CORS headers helper - TEMPORARY PERMISSIVE FOR DEBUGGING
function addCorsHeaders(res, req) {
  // Temporarily allow all origins for debugging
  const requestOrigin = req.headers.origin;
  
  console.log('🔍 CORS Debug - Request Origin:', requestOrigin);
  
  // Set CORS headers to allow the request origin
  res.setHeader('Access-Control-Allow-Origin', requestOrigin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  console.log('✅ CORS Debug - Setting Origin to:', requestOrigin || '*');
}

// Add routes for enhanced tools
const enhancedToolsRouter = require('./enhanced-tools-marden');

// Export the handler
module.exports = async (req, res) => {
  // Add CORS headers immediately for all requests
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,HEAD');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept,Origin,X-Requested-With');
  res.header('Access-Control-Max-Age', '86400');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`OPTIONS request from origin: ${origin}`);
    return res.status(200).end();
  }
  try {
    // BULLETPROOF CORS FIX - Set headers IMMEDIATELY
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    // Handle preflight OPTIONS requests immediately
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Process URL and path
    let url = req.url;
    
    // Get the path from the URL
    const path = url.split('?')[0];
    
    // Health check endpoint
    if (path === '/health' || path === '/api/health') {
      return await handleHealthCheck(req, res);
    }
    
    // Root/info endpoint
    if (path === '/' || path === '/api') {
      return res.status(200).json({
        service: 'Marden SEO Audit API',
        status: 'running',
        endpoints: [
          '/health',
          '/seo-analyze',
          '/basic-audit',
          '/enhanced-seo-analyze', // New enhanced endpoint
          '/schema-analyze',        // New schema analysis endpoint
          '/mobile-analyze'         // New mobile analysis endpoint
        ],
        documentation: 'https://github.com/Kr8thor/marden-audit-backend'
      });
    }
    
    // Apply concurrency limiting middleware
    limitConcurrency(req, res, async () => {
      try {
        // Route to appropriate handler based on path
        if (path === '/seo-analyze' || path === '/api/seo-analyze') {
          await handleSeoAnalyze(req, res);
        }
        // Alias 'basic-audit' endpoint to 'seo-analyze'
        else if (path === '/basic-audit' || path === '/api/basic-audit') {
          await handleSeoAnalyze(req, res);
        }
        // Site audit endpoint
        else if (path === '/site-audit' || path === '/api/site-audit') {
          await handleSiteAudit(req, res);
        }
        // Site crawl endpoint
        else if (path === '/site-crawl' || path === '/api/site-crawl') {
          await handleEnhancedSiteCrawl(req, res);
        }
        // Enhanced SEO analyze endpoint (new) - Route to basic analysis for now
        else if (path === '/enhanced-seo-analyze' || path === '/api/enhanced-seo-analyze') {
          // For now, route to the working basic analysis
          await handleSeoAnalyze(req, res);
        }
        // Schema analysis endpoint (new)
        else if (path === '/schema-analyze' || path === '/api/schema-analyze') {
          const schemaValidator = require('./schema-validator-marden');
          
          // Extract URL parameter
          let requestUrl = '';
          if (req.method === 'POST') {
            requestUrl = req.body.url;
          } else {
            requestUrl = req.query.url;
          }
          
          if (!requestUrl) {
            return res.status(400).json({
              status: 'error',
              message: 'URL parameter is required',
              timestamp: new Date().toISOString()
            });
          }
          
          // Normalize URL
          const normalizedUrl = normalizeUrl(requestUrl);
          
          // Generate cache key
          const cacheKey = `schema-analyze:${normalizedUrl}`;
          
          // Check cache
          let cachedResult = null;
          if (redis.isRedisConfigured) {
            try {
              cachedResult = await redis.getCache(cacheKey);
              
              if (cachedResult) {
                console.log(`Cache hit for schema analysis: ${normalizedUrl}`);
                return res.status(200).json({
                  status: 'ok',
                  message: 'Schema analysis retrieved from cache',
                  url: normalizedUrl,
                  cached: true,
                  cachedAt: cachedResult.timestamp,
                  timestamp: new Date().toISOString(),
                  data: cachedResult.data
                });
              }
            } catch (cacheError) {
              console.error('Error checking cache:', cacheError);
            }
          }
          
          // Perform analysis
          const result = await schemaValidator.analyzeStructuredData(normalizedUrl);
          
          // Cache result
          if (redis.isRedisConfigured) {
            try {
              await redis.setCache(cacheKey, {
                data: result,
                timestamp: new Date().toISOString()
              }, 86400); // 24 hour cache
            } catch (cacheError) {
              console.error('Error caching result:', cacheError);
            }
          }
          
          // Return result
          return res.status(200).json({
            status: 'ok',
            message: 'Schema analysis completed',
            url: normalizedUrl,
            cached: false,
            timestamp: new Date().toISOString(),
            data: result
          });
        }
        // Mobile-friendliness analysis endpoint (new)
        else if (path === '/mobile-analyze' || path === '/api/mobile-analyze') {
          const mobileFriendly = require('./mobile-friendly-marden');
          
          // Extract URL parameter
          let requestUrl = '';
          if (req.method === 'POST') {
            requestUrl = req.body.url;
          } else {
            requestUrl = req.query.url;
          }
          
          if (!requestUrl) {
            return res.status(400).json({
              status: 'error',
              message: 'URL parameter is required',
              timestamp: new Date().toISOString()
            });
          }
          
          // Normalize URL
          const normalizedUrl = normalizeUrl(requestUrl);
          
          // Generate cache key
          const cacheKey = `mobile-analyze:${normalizedUrl}`;
          
          // Check cache
          let cachedResult = null;
          if (redis.isRedisConfigured) {
            try {
              cachedResult = await redis.getCache(cacheKey);
              
              if (cachedResult) {
                console.log(`Cache hit for mobile analysis: ${normalizedUrl}`);
                return res.status(200).json({
                  status: 'ok',
                  message: 'Mobile-friendliness analysis retrieved from cache',
                  url: normalizedUrl,
                  cached: true,
                  cachedAt: cachedResult.timestamp,
                  timestamp: new Date().toISOString(),
                  data: cachedResult.data
                });
              }
            } catch (cacheError) {
              console.error('Error checking cache:', cacheError);
            }
          }
          
          // Perform analysis
          const result = await mobileFriendly.analyzeMobileFriendliness(normalizedUrl);
          
          // Cache result
          if (redis.isRedisConfigured) {
            try {
              await redis.setCache(cacheKey, {
                data: result,
                timestamp: new Date().toISOString()
              }, 86400); // 24 hour cache
            } catch (cacheError) {
              console.error('Error caching result:', cacheError);
            }
          }
          
          // Return result
          return res.status(200).json({
            status: 'ok',
            message: 'Mobile-friendliness analysis completed',
            url: normalizedUrl,
            cached: false,
            timestamp: new Date().toISOString(),
            data: result
          });
        }
        else {
          // Unknown endpoint
          res.status(404).json({
            status: 'error',
            message: 'Endpoint not found',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error handling route:', error);
        
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
          timestamp: new Date().toISOString()
        });
      } finally {
        // Always release the request slot
        releaseRequest();
      }
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