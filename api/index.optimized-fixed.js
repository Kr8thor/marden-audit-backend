// Optimized API endpoint for SEO audit to reduce CPU usage on Railway
// While maintaining FULL audit functionality
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

// Global concurrency control with reasonable limits
const CONCURRENCY_LIMIT = process.env.MAX_CONCURRENCY || 3;
let activeRequests = 0;
const pendingRequests = [];

// Simple memory-based cache for emergency fallback
const memoryCache = new Map();

// Add CORS headers
function addCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin, Cache-Control');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
}

// Request throttling middleware
function limitConcurrency(req, res, next) {
  if (activeRequests >= CONCURRENCY_LIMIT) {
    // Try memory cache for quick response under load
    const { url: requestUrl } = req.body || req.query || {};
    
    if (requestUrl) {
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
    
    // Queue the request if below threshold
    if (pendingRequests.length < 10) {
      pendingRequests.push({ req, res, next });
      console.log(`Request queued. Active: ${activeRequests}, Pending: ${pendingRequests.length}`);
      return;
    }
    
    // If queue is too full, return a service busy message
    return res.status(503).json({
      status: 'busy',
      message: 'Server is currently experiencing high demand. Please try again in a few minutes.',
      url: requestUrl,
      timestamp: new Date().toISOString()
    });
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
          timeout(2000).then(() => false)  // Increased timeout for reliability
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
 * Perform FULL SEO analysis with CPU optimization
 * Maintains all critical audit functionality
 */
async function analyzeSeo(urlString) {
  try {
    console.log(`Full analysis for ${urlString}`);
    const startTime = Date.now();
    
    // Fetch with reasonable timeout
    let response;
    try {
      response = await axios.get(urlString, {
        timeout: 15000,  // 15 second timeout
        headers: {
          'User-Agent': 'MardenSEOAuditBot/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache'
        }
      });
    } catch (error) {
      // Handle common fetch errors with detailed reporting
      let errorMessage = 'Failed to fetch the page';
      let errorType = 'fetch_error';
      
      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused. The server may be down or blocking requests.';
        errorType = 'connection_refused';
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
        errorMessage = 'Request timed out. The server took too long to respond.';
        errorType = 'timeout';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Domain not found. The URL may be incorrect or the domain may not exist.';
        errorType = 'domain_not_found';
      } else if (error.response) {
        // The request was made and the server responded with a status code outside of 2xx
        const status = error.response.status;
        
        if (status === 403) {
          errorMessage = 'Access forbidden. The server refused to allow access to the requested resource.';
          errorType = 'access_forbidden';
        } else if (status === 404) {
          errorMessage = 'Page not found. The requested URL does not exist on this server.';
          errorType = 'not_found';
        } else if (status === 500) {
          errorMessage = 'Server error. The server encountered an unexpected condition.';
          errorType = 'server_error';
        } else if (status === 503) {
          errorMessage = 'Service unavailable. The server is currently unable to handle the request.';
          errorType = 'service_unavailable';
        } else {
          errorMessage = `HTTP error ${status}. The server returned an error response.`;
          errorType = 'http_error';
        }
      }
      
      throw {
        type: errorType,
        message: errorMessage,
        originalError: error.message
      };
    }
    
    // Optimized Cheerio load with reduced overheard
    const $ = cheerio.load(response.data, {
      normalizeWhitespace: false,  // Skip whitespace normalization
      xmlMode: false,
      decodeEntities: false
    });
    
    // Extract key SEO elements
    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const h1Count = $('h1').length;
    const h2Count = $('h2').length;
    const h3Count = $('h3').length;
    const canonicalTag = $('link[rel="canonical"]').attr('href') || '';
    const robotsTag = $('meta[name="robots"]').attr('content') || '';
    const hasMobileViewport = $('meta[name="viewport"]').length > 0;
    
    // Extract headings more efficiently
    const headings = {
      h1: [],
      h2: [],
      h3: []
    };
    
    // Use array methods for better performance
    $('h1').each((i, el) => {
      if (headings.h1.length < 10) { // Limit to 10 to reduce CPU load
        headings.h1.push($(el).text().trim());
      }
    });
    
    $('h2').each((i, el) => {
      if (headings.h2.length < 15) { // Limit to 15 to reduce CPU load
        headings.h2.push($(el).text().trim());
      }
    });
    
    $('h3').each((i, el) => {
      if (headings.h3.length < 15) { // Limit to 15 to reduce CPU load
        headings.h3.push($(el).text().trim());
      }
    });
    
    // Extract images efficiently
    const imgCount = $('img').length;
    let imgWithoutAltCount = 0;
    
    // Sample up to 20 images for alt text check (performance optimization)
    const sampleImages = $('img').slice(0, 20);
    sampleImages.each((i, el) => {
      if (!$(el).attr('alt')) {
        imgWithoutAltCount++;
      }
    });
    
    // Estimate total images without alt text based on sample
    const estimatedImgWithoutAlt = imgCount > 20 
      ? Math.round(imgWithoutAltCount / sampleImages.length * imgCount)
      : imgWithoutAltCount;
    
    // Count links efficiently
    const allLinks = $('a[href]');
    let internalLinks = 0;
    let externalLinks = 0;
    let nofollowLinks = 0;
    
    try {
      const baseUrlObj = new URL(urlString);
      
      // Sample up to 50 links to reduce CPU usage
      const sampleLinks = allLinks.slice(0, 50);
      sampleLinks.each((i, el) => {
        const href = $(el).attr('href');
        
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
          return;
        }
        
        try {
          const linkUrl = new URL(href, urlString);
          const hasNofollow = $(el).attr('rel')?.includes('nofollow') || false;
          
          if (linkUrl.hostname === baseUrlObj.hostname) {
            internalLinks++;
          } else {
            externalLinks++;
          }
          
          if (hasNofollow) {
            nofollowLinks++;
          }
        } catch (error) {
          // Skip malformed URLs
        }
      });
      
      // Estimate total counts based on sample
      if (allLinks.length > 50) {
        const ratio = allLinks.length / 50;
        internalLinks = Math.round(internalLinks * ratio);
        externalLinks = Math.round(externalLinks * ratio);
        nofollowLinks = Math.round(nofollowLinks * ratio);
      }
    } catch (error) {
      console.error('Error processing links:', error.message);
    }
    
    // Calculate content metrics efficiently
    let contentText = '';
    try {
      // Remove script, style, noscript elements for text content analysis
      $('script, style, noscript').remove();
      contentText = $('body').text();
      
      // Clean up whitespace more efficiently
      contentText = contentText.replace(/\s+/g, ' ').trim();
    } catch (error) {
      console.error('Error extracting content text:', error.message);
      contentText = 'Error analyzing content';
    }
    
    const wordCount = contentText.split(/\s+/).length;
    const contentLength = contentText.length;
    
    // Check for structured data
    const hasStructuredData = $('script[type="application/ld+json"]').length > 0;
    const hasMicrodata = $('[itemscope]').length > 0;
    
    // Check for Open Graph and Twitter tags
    const hasOpenGraph = $('meta[property^="og:"]').length > 0;
    const hasTwitterCards = $('meta[name^="twitter:"]').length > 0;
    
    // More efficient Open Graph extraction
    const openGraphTags = {
      title: $('meta[property="og:title"]').attr('content') || '',
      description: $('meta[property="og:description"]').attr('content') || '',
      image: $('meta[property="og:image"]').attr('content') || '',
      url: $('meta[property="og:url"]').attr('content') || '',
      type: $('meta[property="og:type"]').attr('content') || ''
    };
    
    // More efficient Twitter Card extraction
    const twitterTags = {
      card: $('meta[name="twitter:card"]').attr('content') || '',
      title: $('meta[name="twitter:title"]').attr('content') || '',
      description: $('meta[name="twitter:description"]').attr('content') || '',
      image: $('meta[name="twitter:image"]').attr('content') || ''
    };
    
    // Calculate score based on factors
    let score = 100;
    const issues = [];
    
    // Organize issues by category for V2 API format
    const categories = {
      metadata: {
        score: 100,
        issues: []
      },
      content: {
        score: 100,
        issues: []
      },
      technical: {
        score: 100,
        issues: []
      },
      userExperience: {
        score: 100,
        issues: []
      }
    };
    
    // Title checks
    if (!title) {
      score -= 20;
      categories.metadata.score -= 25;
      categories.metadata.issues.push({
        type: 'missing_title',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Add a title tag to your page'
      });
    } else if (title.length < 30) {
      score -= 10;
      categories.metadata.score -= 15;
      categories.metadata.issues.push({
        type: 'title_too_short',
        severity: 'warning',
        impact: 'medium',
        current: title,
        recommendation: 'Make your title tag longer (30-60 characters recommended)'
      });
    } else if (title.length > 60) {
      score -= 5;
      categories.metadata.score -= 10;
      categories.metadata.issues.push({
        type: 'title_too_long',
        severity: 'info',
        impact: 'low',
        current: title,
        recommendation: 'Consider shortening your title tag (30-60 characters recommended)'
      });
    }
    
    // Meta description checks
    if (!metaDescription) {
      score -= 15;
      categories.metadata.score -= 20;
      categories.metadata.issues.push({
        type: 'missing_meta_description',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Add a meta description to your page'
      });
    } else if (metaDescription.length < 50) {
      score -= 10;
      categories.metadata.score -= 15;
      categories.metadata.issues.push({
        type: 'meta_description_too_short',
        severity: 'warning',
        impact: 'medium',
        current: metaDescription,
        recommendation: 'Make your meta description longer (50-160 characters recommended)'
      });
    } else if (metaDescription.length > 160) {
      score -= 5;
      categories.metadata.score -= 10;
      categories.metadata.issues.push({
        type: 'meta_description_too_long',
        severity: 'info',
        impact: 'low',
        current: metaDescription,
        recommendation: 'Consider shortening your meta description (50-160 characters recommended)'
      });
    }
    
    // H1 checks
    if (h1Count === 0) {
      score -= 15;
      categories.content.score -= 20;
      categories.content.issues.push({
        type: 'missing_h1',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Add an H1 heading to your page'
      });
    } else if (h1Count > 1) {
      score -= 10;
      categories.content.score -= 15;
      categories.content.issues.push({
        type: 'multiple_h1',
        severity: 'warning',
        impact: 'medium',
        current: h1Count,
        recommendation: 'Use only one H1 heading per page'
      });
    }
    
    // Content length check
    if (wordCount < 300) {
      score -= 10;
      categories.content.score -= 15;
      categories.content.issues.push({
        type: 'thin_content',
        severity: 'warning',
        impact: 'medium',
        current: wordCount,
        recommendation: 'Add more content to your page (aim for at least 300 words)'
      });
    }
    
    // Image alt text check
    if (estimatedImgWithoutAlt > 0 && imgCount > 0) {
      const penaltyPoints = Math.min(15, Math.round(estimatedImgWithoutAlt / imgCount * 15));
      score -= penaltyPoints;
      categories.content.score -= Math.min(20, penaltyPoints);
      categories.content.issues.push({
        type: 'images_missing_alt',
        severity: 'warning',
        impact: 'medium',
        count: estimatedImgWithoutAlt,
        current: `${estimatedImgWithoutAlt} of ${imgCount} images`,
        recommendation: 'Add alt text to all images for better accessibility and SEO'
      });
    }
    
    // Canonical check
    if (!canonicalTag) {
      score -= 5;
      categories.technical.score -= 10;
      categories.technical.issues.push({
        type: 'missing_canonical',
        severity: 'info',
        impact: 'low',
        recommendation: 'Add a canonical tag to indicate the preferred version of this page'
      });
    }
    
    // Mobile viewport check
    if (!hasMobileViewport) {
      score -= 10;
      categories.userExperience.score -= 20;
      categories.userExperience.issues.push({
        type: 'missing_viewport',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Add a viewport meta tag for proper mobile rendering'
      });
    }
    
    // Structured data check
    if (!hasStructuredData && !hasMicrodata) {
      score -= 5;
      categories.technical.score -= 10;
      categories.technical.issues.push({
        type: 'no_structured_data',
        severity: 'info',
        impact: 'medium',
        recommendation: 'Add structured data to help search engines understand your content'
      });
    }
    
    // Social media tags check
    if (!hasOpenGraph) {
      categories.metadata.score -= 5;
      categories.metadata.issues.push({
        type: 'missing_og_tags',
        severity: 'info',
        impact: 'low',
        recommendation: 'Add Open Graph tags for better social media sharing'
      });
    }
    
    if (!hasTwitterCards) {
      categories.metadata.score -= 5;
      categories.metadata.issues.push({
        type: 'missing_twitter_tags',
        severity: 'info',
        impact: 'low',
        recommendation: 'Add Twitter Card tags for better Twitter sharing'
      });
    }
    
    // Ensure scores stay within 0-100 range
    score = Math.max(0, Math.min(100, score));
    categories.metadata.score = Math.max(0, Math.min(100, categories.metadata.score));
    categories.content.score = Math.max(0, Math.min(100, categories.content.score));
    categories.technical.score = Math.max(0, Math.min(100, categories.technical.score));
    categories.userExperience.score = Math.max(0, Math.min(100, categories.userExperience.score));
    
    // Determine overall status
    let status = 'good';
    if (score < 50) {
      status = 'poor';
    } else if (score < 80) {
      status = 'needs_improvement';
    }
    
    // Calculate critical issues count
    const criticalIssuesCount = 
      categories.metadata.issues.filter(i => i.severity === 'critical').length +
      categories.content.issues.filter(i => i.severity === 'critical').length +
      categories.technical.issues.filter(i => i.severity === 'critical').length +
      categories.userExperience.issues.filter(i => i.severity === 'critical').length;
    
    // Calculate total issues count
    const totalIssuesCount = 
      categories.metadata.issues.length +
      categories.content.issues.length +
      categories.technical.issues.length +
      categories.userExperience.issues.length;
    
    // Generate recommendations from issues
    const recommendations = [];
    
    // Add critical issues as high priority recommendations
    [...categories.metadata.issues, 
     ...categories.content.issues, 
     ...categories.technical.issues, 
     ...categories.userExperience.issues]
      .filter(issue => issue.severity === 'critical')
      .forEach(issue => {
        recommendations.push({
          priority: 'high',
          type: issue.type,
          description: issue.recommendation
        });
      });
    
    // Add warning issues as medium priority recommendations
    [...categories.metadata.issues, 
     ...categories.content.issues, 
     ...categories.technical.issues, 
     ...categories.userExperience.issues]
      .filter(issue => issue.severity === 'warning')
      .forEach(issue => {
        recommendations.push({
          priority: 'medium',
          type: issue.type,
          description: issue.recommendation
        });
      });
    
    // Add info issues as low priority recommendations
    [...categories.metadata.issues, 
     ...categories.content.issues, 
     ...categories.technical.issues, 
     ...categories.userExperience.issues]
      .filter(issue => issue.severity === 'info')
      .forEach(issue => {
        recommendations.push({
          priority: 'low',
          type: issue.type,
          description: issue.recommendation
        });
      });
    
    // Performance metrics
    const endTime = Date.now();
    const analysisTime = endTime - startTime;
    
    // Return analysis results in V2 API format
    return {
      url: urlString,
      score,
      status,
      criticalIssuesCount,
      totalIssuesCount,
      categories,
      recommendations,
      pageData: {
        title: {
          text: title,
          length: title.length
        },
        metaDescription: {
          text: metaDescription,
          length: metaDescription.length
        },
        headings: {
          h1Count,
          h1Texts: headings.h1,
          h2Count,
          h2Texts: headings.h2,
          h3Count
        },
        content: {
          wordCount,
          contentLength
        },
        links: {
          internalCount: internalLinks,
          externalCount: externalLinks,
          totalCount: internalLinks + externalLinks,
          nofollowCount: nofollowLinks
        },
        images: {
          total: imgCount,
          withoutAlt: estimatedImgWithoutAlt
        },
        technical: {
          hasCanonical: !!canonicalTag,
          canonicalUrl: canonicalTag,
          hasMobileViewport,
          hasStructuredData: hasStructuredData || hasMicrodata,
          hasOpenGraph,
          hasTwitterCards
        }
      },
      // For backward compatibility
      pageAnalysis: {
        title: {
          text: title,
          length: title.length
        },
        metaDescription: {
          text: metaDescription,
          length: metaDescription.length
        },
        headings: {
          h1Count,
          h1Texts: headings.h1,
          h2Count,
          h2Texts: headings.h2,
          h3Count
        },
        links: {
          internalCount: internalLinks,
          externalCount: externalLinks,
          totalCount: internalLinks + externalLinks
        },
        images: {
          withoutAltCount: estimatedImgWithoutAlt,
          total: imgCount
        },
        contentLength,
        canonical: canonicalTag
      },
      issuesFound: totalIssuesCount,
      opportunities: Math.min(totalIssuesCount, 10),
      metadata: {
        analysisTime,
        responseSize: response.headers['content-length'] ? 
          parseInt(response.headers['content-length']) : 
          response.data.length,
        responseTime: response.headers['x-response-time'] ? 
          parseInt(response.headers['x-response-time']) : 
          null
      },
      analyzedAt: new Date().toISOString(),
      analyzedWith: 'full'
    };
  } catch (error) {
    console.error(`Error analyzing SEO for ${urlString}:`, error);
    
    // Return structured error response
    return {
      url: urlString,
      score: 0,
      status: 'error',
      error: {
        type: error.type || 'analysis_error',
        message: error.message || 'Failed to analyze SEO for the provided URL',
        details: error.originalError || error.toString()
      },
      analyzedAt: new Date().toISOString()
    };
  }
}

/**
 * Handle SEO analysis endpoint with CPU optimization
 * But maintaining FULL functionality
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
        
        // Try to get cached results with reasonable timeout
        const cachedResults = await Promise.race([
          redis.getCache(cacheKey),
          timeout(2000).then(() => null) // 2000ms timeout for Redis
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
      console.log(`Performing full SEO analysis for ${normalizedUrl}`);
      
      // Use the full analyzeSeo function with performance optimizations
      analysisResults = await analyzeSeo(normalizedUrl);
      
      // Cache successful results
      if (!analysisResults.error) {
        // Always update memory cache
        memoryCache.set(memoryCacheKey, {
          data: analysisResults,
          timestamp: Date.now()
        });
        
        // Try to update Redis cache without waiting for completion
        if (redis.isRedisConfigured) {
          try {
            const cacheKey = redis.generateCacheKey(normalizedUrl);
            // Don't await - run in background
            redis.setCache(cacheKey, {
              data: analysisResults,
              timestamp: new Date().toISOString()
            }, 86400).catch(err => console.error('Background Redis caching error:', err));
          } catch (error) {
            console.error('Error initiating Redis caching:', error);
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
    }, 20000); // 20 second timeout - balancing quality and performance
    
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
    
    // SEO analysis endpoint
    if (path === '/v2/seo-analyze' || path === '/seo-analyze' || path === '/api/real-seo-audit' || 
        path === '/api/seo-analyze' || path === '/analyze') {
      return await limitConcurrency(req, res, async () => {
        await handleSeoAnalyze(req, res);
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
        version: 'v2.1-railway',
        endpoints: {
          health: '/api/health',
          basic: '/api/basic-audit?url=example.com',
          seo: '/api/seo-analyze'
        },
        memory: {
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