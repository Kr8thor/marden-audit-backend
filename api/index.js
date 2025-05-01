// Simple consolidated API endpoint for all SEO audit operations
const axios = require('axios');
const cheerio = require('cheerio');
const url = require('url');
const { Redis } = require('@upstash/redis');

// Initialize Redis client
let redis;
try {
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://smiling-shrimp-21387.upstash.io';
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'AVOLAAIjcDFmNzVjNDVjZGM3MGY0NDczODEyMTA0NTAyOGNkMTc5OXAxMA';
  
  redis = new Redis({
    url: REDIS_URL,
    token: REDIS_TOKEN,
  });
  console.log('Redis initialized successfully');
} catch (error) {
  console.error('Failed to initialize Redis:', error);
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin, Cache-Control');
}

/**
 * Normalize URL for consistent cache keys
 */
function normalizeUrl(urlString) {
  if (!urlString) return '';
  
  try {
    // Ensure URL has protocol
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      urlString = 'https://' + urlString;
    }
    
    const urlObj = new URL(urlString);
    
    // Remove trailing slash, 'www.', and convert to lowercase
    let normalized = urlObj.hostname.replace(/^www\./, '').toLowerCase();
    
    // Append path (without trailing slash)
    if (urlObj.pathname && urlObj.pathname !== '/') {
      normalized += urlObj.pathname.replace(/\/$/, '');
    }
    
    return normalized;
  } catch (error) {
    console.error(`Error normalizing URL ${urlString}:`, error);
    // Return original URL if parsing fails
    return urlString.toLowerCase();
  }
}

/**
 * Handler for health check endpoint
 */
async function handleHealthCheck(req, res) {
  try {
    // Check Redis connection
    let redisStatus = 'ok';
    let redisError = null;
    
    try {
      // Test Redis connection
      const testKey = 'health:check:' + Date.now();
      await redis.set(testKey, 'test', { ex: 10 });
      const testValue = await redis.get(testKey);
      
      if (testValue !== 'test') {
        redisStatus = 'error';
        redisError = 'Redis read/write test failed';
      }
    } catch (error) {
      redisStatus = 'error';
      redisError = error.message;
    }
    
    return res.status(200).json({
      status: 'ok',
      version: 'v2',
      message: 'Marden SEO Audit API is operational',
      components: {
        redis: {
          status: redisStatus,
          error: redisError
        },
        api: {
          status: 'ok'
        }
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
 * Quick SEO analysis
 */
async function quickSeoAnalysis(req, res) {
  try {
    // Extract URL from request
    let url;
    if (req.method === 'POST') {
      try {
        const requestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        url = requestBody.url;
      } catch (e) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Invalid request body',
          timestamp: new Date().toISOString()
        });
      }
    } else if (req.query.url) {
      url = req.query.url;
    }
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL parameter is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Normalize URL
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    
    try {
      // Validate URL format
      new URL(normalizedUrl);
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid URL provided',
        timestamp: new Date().toISOString()
      });
    }
    
    // Analyze the website
    try {
      // Fetch the page
      const response = await axios.get(normalizedUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'MardenSEOAuditBot/1.0'
        }
      });
      
      // Parse with cheerio
      const $ = cheerio.load(response.data);
      
      // Extract basic SEO elements
      const title = $('title').text().trim();
      const metaDescription = $('meta[name="description"]').attr('content') || '';
      const h1Text = $('h1').first().text().trim();
      const h1Count = $('h1').length;
      const h2Count = $('h2').length;
      const canonicalTag = $('link[rel="canonical"]').attr('href') || '';
      
      // Extract headings
      const h1s = [];
      $('h1').each((i, el) => {
        h1s.push($(el).text().trim());
      });
      
      const h2s = [];
      $('h2').each((i, el) => {
        h2s.push($(el).text().trim());
      });
      
      // Count images without alt text
      let imagesWithoutAlt = 0;
      $('img').each((i, el) => {
        if (!$(el).attr('alt')) {
          imagesWithoutAlt++;
        }
      });
      
      // Count links
      let internalLinks = 0;
      let externalLinks = 0;
      
      $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        
        if (!href || href.startsWith('#')) {
          return;
        }
        
        try {
          const linkUrl = new URL(href, normalizedUrl);
          
          if (linkUrl.hostname === new URL(normalizedUrl).hostname) {
            internalLinks++;
          } else {
            externalLinks++;
          }
        } catch (error) {
          // Skip malformed URLs
        }
      });
      
      // Simple scoring
      let score = 100;
      let issuesFound = 0;
      
      // Title checks
      if (!title) {
        score -= 20;
        issuesFound++;
      } else if (title.length < 20 || title.length > 60) {
        score -= 10;
        issuesFound++;
      }
      
      // Meta description checks
      if (!metaDescription) {
        score -= 15;
        issuesFound++;
      } else if (metaDescription.length < 50 || metaDescription.length > 160) {
        score -= 10;
        issuesFound++;
      }
      
      // H1 checks
      if (h1Count === 0) {
        score -= 15;
        issuesFound++;
      } else if (h1Count > 1) {
        score -= 10;
        issuesFound++;
      }
      
      // Images without alt text
      if (imagesWithoutAlt > 0) {
        score -= Math.min(15, imagesWithoutAlt * 2);
        issuesFound++;
      }
      
      // Canonical tag
      if (!canonicalTag) {
        score -= 5;
        issuesFound++;
      }
      
      // Ensure score stays within 0-100 range
      score = Math.max(0, Math.min(100, score));
      
      // Return results
      return res.status(200).json({
        status: 'ok',
        message: 'SEO analysis completed',
        url: normalizedUrl,
        timestamp: new Date().toISOString(),
        data: {
          url: normalizedUrl,
          score,
          issuesFound,
          opportunities: Math.max(0, issuesFound - 1),
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
              h1Texts: h1s.slice(0, 5),
              h2Count,
              h2Texts: h2s.slice(0, 5)
            },
            links: {
              internalCount: internalLinks,
              externalCount: externalLinks,
              totalCount: internalLinks + externalLinks
            },
            images: {
              withoutAltCount: imagesWithoutAlt
            },
            canonical: canonicalTag
          }
        }
      });
    } catch (error) {
      console.error(`Error analyzing URL ${normalizedUrl}:`, error);
      return res.status(500).json({
        status: 'error',
        message: `Error analyzing URL: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error in SEO analysis:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Main API handler
 */
module.exports = async (req, res) => {
  // Add CORS headers
  addCorsHeaders(res);
  
  // Handle OPTIONS request
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
    
    // Route based on path
    if (path === '/v2/health' || path === '/health' || path === '/api/health') {
      return await handleHealthCheck(req, res);
    } else if (path === '/v2/seo-analyze' || path === '/seo-analyze' || path === '/api/seo-analyze' || 
               path === '/api/real-seo-audit' || path === '/real-seo-audit') {
      return await quickSeoAnalysis(req, res);
    } else if (path === '/' || path === '' || path === '/api' || path === '/api/') {
      // Root path - return API info
      return res.status(200).json({
        status: 'ok',
        message: 'Marden SEO Audit API',
        version: 'v2',
        endpoints: [
          '/v2/health',
          '/v2/seo-analyze',
          '/api/real-seo-audit'
        ],
        timestamp: new Date().toISOString()
      });
    }
    
    // If we get here, route to SEO analysis by default (for compatibility)
    return await quickSeoAnalysis(req, res);
  } catch (error) {
    console.error('Error handling request:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};