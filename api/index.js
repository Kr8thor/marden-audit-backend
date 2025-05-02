// Unified API endpoint for SEO audit to stay under Vercel's Hobby plan limits
// This consolidates multiple endpoints into a single serverless function
const axios = require('axios');
const cheerio = require('cheerio');
const url = require('url');

// Import Redis client for caching if configured
let redis;
try {
  redis = require('./lib/redis');
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

// Add CORS headers
function addCorsHeaders(res) {
  // Set CORS headers to allow all origins for now (can be restricted later)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin, Cache-Control');
  
  // Add extra security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Log CORS setup for debugging
  console.log('CORS headers added to response');
}

/**
 * Normalize URL to ensure proper format
 * @param {string} url URL to normalize
 * @returns {string} Normalized URL with proper protocol
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
        const redisHealth = await redis.checkHealth();
        redisStatus = {
          status: redisHealth ? 'ok' : 'error',
          message: redisHealth ? 'Connected' : 'Connection failed'
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
      version: 'v2',
      message: 'Marden SEO Audit API is operational',
      components: {
        api: {
          status: 'ok'
        },
        redis: redisStatus
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
 * Analyze SEO for a specific URL
 */
async function analyzeSeo(urlString) {
  try {
    console.log(`Analyzing SEO for ${urlString}`);
    const startTime = Date.now();
    
    // Fetch the page with appropriate error handling
    let response;
    try {
      response = await axios.get(urlString, {
        timeout: 15000,
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
    
    // Load content into cheerio
    const $ = cheerio.load(response.data);
    
    // Extract key SEO elements
    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const h1Text = $('h1').first().text().trim();
    const h1Count = $('h1').length;
    const h2Count = $('h2').length;
    const h3Count = $('h3').length;
    const canonicalTag = $('link[rel="canonical"]').attr('href') || '';
    const robotsTag = $('meta[name="robots"]').attr('content') || '';
    const hasMobileViewport = $('meta[name="viewport"]').length > 0;
    
    // Extract headings
    const headings = {
      h1: [],
      h2: [],
      h3: []
    };
    
    $('h1').each((i, el) => {
      headings.h1.push($(el).text().trim());
    });
    
    $('h2').each((i, el) => {
      headings.h2.push($(el).text().trim());
    });
    
    $('h3').each((i, el) => {
      headings.h3.push($(el).text().trim());
    });
    
    // Extract all images and count those without alt text
    const allImages = [];
    const imagesWithoutAlt = [];
    $('img').each((i, el) => {
      const alt = $(el).attr('alt');
      const src = $(el).attr('src');
      if (src) {
        allImages.push({
          src,
          alt: alt || '',
          hasAlt: !!alt
        });
        
        if (!alt) {
          imagesWithoutAlt.push(src);
        }
      }
    });
    
    // Count links and analyze them
    const links = {
      internal: 0,
      external: 0,
      total: 0,
      nofollow: 0,
      brokenInternalLinks: [] // Would require additional requests to verify
    };
    
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        return;
      }
      
      try {
        const linkUrl = new URL(href, urlString);
        const hasNofollow = $(el).attr('rel')?.includes('nofollow') || false;
        
        if (linkUrl.hostname === new URL(urlString).hostname) {
          links.internal++;
        } else {
          links.external++;
        }
        
        if (hasNofollow) {
          links.nofollow++;
        }
        
        links.total++;
      } catch (error) {
        // Skip malformed URLs
      }
    });
    
    // Calculate content statistics
    let contentText = $('body').text().trim();
    contentText = contentText.replace(/\s+/g, ' ');
    const wordCount = contentText.split(/\s+/).length;
    const contentLength = contentText.length;
    
    // Check for structured data
    const structuredData = [];
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const jsonText = $(el).html();
        const json = JSON.parse(jsonText);
        structuredData.push({
          type: json['@type'] || 'Unknown'
        });
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    // Check for schema.org microdata
    const hasMicrodata = $('[itemscope]').length > 0;
    
    // Check for Open Graph and Twitter tags
    const openGraphTags = {
      title: $('meta[property="og:title"]').attr('content') || '',
      description: $('meta[property="og:description"]').attr('content') || '',
      image: $('meta[property="og:image"]').attr('content') || '',
      url: $('meta[property="og:url"]').attr('content') || '',
      type: $('meta[property="og:type"]').attr('content') || ''
    };
    
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
    if (imagesWithoutAlt.length > 0) {
      const penaltyPoints = Math.min(15, imagesWithoutAlt.length * 3);
      score -= penaltyPoints;
      categories.content.score -= Math.min(20, penaltyPoints);
      categories.content.issues.push({
        type: 'images_missing_alt',
        severity: 'warning',
        impact: 'medium',
        count: imagesWithoutAlt.length,
        current: `${imagesWithoutAlt.length} of ${allImages.length} images`,
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
    if (structuredData.length === 0 && !hasMicrodata) {
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
    if (!openGraphTags.title && !openGraphTags.description) {
      categories.metadata.score -= 5;
      categories.metadata.issues.push({
        type: 'missing_og_tags',
        severity: 'info',
        impact: 'low',
        recommendation: 'Add Open Graph tags for better social media sharing'
      });
    }
    
    if (!twitterTags.card && !twitterTags.title) {
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
    
    // Performance metrics calculation
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
          internalCount: links.internal,
          externalCount: links.external,
          totalCount: links.total
        },
        images: {
          total: allImages.length,
          withoutAlt: imagesWithoutAlt.length
        },
        technical: {
          hasCanonical: !!canonicalTag,
          canonicalUrl: canonicalTag,
          hasMobileViewport,
          hasStructuredData: structuredData.length > 0 || hasMicrodata,
          structuredDataTypes: structuredData.map(item => item.type)
        }
      },
      // Include original format fields for backward compatibility
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
          internalCount: links.internal,
          externalCount: links.external,
          totalCount: links.total
        },
        images: {
          withoutAltCount: imagesWithoutAlt.length,
          total: allImages.length
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
      analyzedAt: new Date().toISOString()
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
 * Handle SEO analysis endpoint
 */
async function handleSeoAnalyze(req, res) {
  try {
    // Extract request body
    let requestBody = req.body;
    
    // Parse body if it's a string
    if (typeof requestBody === 'string') {
      try {
        requestBody = JSON.parse(requestBody);
      } catch (e) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid JSON in request body',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Get URL and options from request body
    const { url, options } = requestBody;
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Normalize and validate URL format
    const normalizedUrl = normalizeUrl(url);
    try {
      new URL(normalizedUrl);
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid URL provided',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check for cached results if Redis is configured
    let analysisResults;
    let cached = false;
    let cachedAt = null;
    
    if (redis.isRedisConfigured) {
      try {
        // Generate cache key from URL and options
        const cacheKey = redis.generateCacheKey(normalizedUrl, options || {});
        console.log(`Checking cache for key: ${cacheKey}`);
        
        // Try to get cached results
        const cachedResults = await redis.getCache(cacheKey);
        
        if (cachedResults) {
          console.log(`Cache hit for ${normalizedUrl}`);
          analysisResults = cachedResults.data;
          cached = true;
          cachedAt = cachedResults.timestamp;
        } else {
          console.log(`Cache miss for ${normalizedUrl}, performing analysis`);
        }
      } catch (error) {
        console.error('Error checking cache:', error);
        // Continue with analysis if cache check fails
      }
    }
    
    // If no cached results, perform analysis
    if (!analysisResults) {
      console.log(`Performing SEO analysis for ${normalizedUrl}`);
      analysisResults = await analyzeSeo(normalizedUrl, options || {});
      
      // Cache successful results if Redis is configured
      if (redis.isRedisConfigured && !analysisResults.error) {
        try {
          const cacheKey = redis.generateCacheKey(normalizedUrl, options || {});
          // Cache for 24 hours (86400 seconds)
          await redis.setCache(cacheKey, {
            data: analysisResults,
            timestamp: new Date().toISOString()
          }, 86400);
          console.log(`Cached results for ${normalizedUrl}`);
        } catch (error) {
          console.error('Error caching results:', error);
          // Continue without caching if it fails
        }
      }
    }
    
    // Check if analysis resulted in an error
    if (analysisResults.error) {
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
    
    // Global request timeout to prevent hanging serverless functions
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
    }, 25000); // 25 second timeout (just under Vercel's 30s limit)
    
    // Define a function to clear the timeout when the request completes
    const clearRequestTimeout = () => {
      clearTimeout(requestTimeout);
    };
    
    // Add event listeners to clear the timeout when the response is sent
    res.on('finish', clearRequestTimeout);
    res.on('close', clearRequestTimeout);
    
    // Simplified routing based on path and HTTP method
    // Health check endpoint
    if (path === '/v2/health' || path === '/health' || path === '/api/health') {
      return await handleHealthCheck(req, res);
    }
    
    // SEO analysis endpoint - combined to serve all analysis requests
    if (path === '/v2/seo-analyze' || path === '/seo-analyze' || path === '/api/real-seo-audit' || 
        path === '/api/seo-analyze' || path === '/analyze') {
      return await handleSeoAnalyze(req, res);
    }
    
    // Site Audit endpoint - added route to use the existing site.js handler
    if (path === '/submit-site-audit' || path === '/api/submit-site-audit' || path === '/api/site-audit') {
      console.log('Handling site audit request - uses multi-page crawler');
      return await require('./audit/site.js')(req, res);
    }
    
    // Basic audit endpoint - route to the same analyzer for simplicity
    if (path === '/basic-audit' || path === '/api/basic-audit') {
      // Extract URL from query parameters for GET requests
      if (req.method === 'GET' && req.query.url) {
        req.body = { url: req.query.url };
      }
      return await handleSeoAnalyze(req, res);
    }
    
    // Root path - return API info
    if (path === '/' || path === '' || path === '/api' || path === '/api/') {
      return res.status(200).json({
        status: 'ok',
        message: 'Marden SEO Audit API',
        version: 'v2',
        endpoints: {
          health: '/api/health',
          basic: '/api/basic-audit?url=example.com',
          seo: '/api/seo-analyze?url=example.com',
          real: '/api/real-seo-audit?url=example.com',
          site: '/submit-site-audit'
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