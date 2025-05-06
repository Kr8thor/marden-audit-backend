// Batch URL SEO Audit implementation
const axios = require('axios');
const cheerio = require('cheerio');
const url = require('url');

// Import Redis client for caching if configured
let redis;
try {
  redis = require('./lib/redis');
  console.log('Redis client imported successfully for batch audit');
} catch (error) {
  console.warn('Redis client not available for batch audit:', error.message);
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
 * Generate a standardized cache key for batch SEO audits
 * @param {string[]} urls URLs being audited
 * @returns {string} Cache key
 */
function generateBatchCacheKey(urls) {
  // Sort URLs for consistent caching regardless of order
  const sortedUrls = [...urls].sort();
  
  // Create a hash of the URLs
  const urlsString = sortedUrls.join(',');
  const hash = require('crypto')
    .createHash('md5')
    .update(urlsString)
    .digest('hex');
  
  return `batch-seo-audit:${hash}`;
}

/**
 * Generate individual cache keys for each URL
 * @param {string} url URL being audited
 * @returns {string} Cache key
 */
function generateUrlCacheKey(url) {
  // Normalize URL for consistent caching
  const normalizedUrl = normalizeUrl(url).toLowerCase();
  
  return `seo-audit:${normalizedUrl}`;
}

/**
 * Analyze SEO for a specific URL
 * @param {string} urlString URL to analyze 
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeSingleUrl(urlString) {
  const normalizedUrl = normalizeUrl(urlString);
  console.log(`Analyzing SEO for ${normalizedUrl}`);
  
  // Try to get cached result first
  if (redis.isRedisConfigured) {
    try {
      const cacheKey = generateUrlCacheKey(normalizedUrl);
      console.log(`Checking cache for key: ${cacheKey}`);
      
      const cachedResults = await redis.getCache(cacheKey);
      
      if (cachedResults) {
        console.log(`Cache hit for ${normalizedUrl}`);
        return {
          ...cachedResults,
          cached: true,
          cachedAt: cachedResults.timestamp || new Date().toISOString()
        };
      }
      
      console.log(`Cache miss for ${normalizedUrl}, performing analysis`);
    } catch (error) {
      console.error('Error checking cache:', error);
      // Continue with analysis if cache check fails
    }
  }
  
  try {
    // Start performance measurement
    const startTime = Date.now();
    
    // Fetch the page with appropriate error handling
    let response;
    try {
      response = await axios.get(normalizedUrl, {
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
      
      return {
        url: normalizedUrl,
        timestamp: new Date().toISOString(),
        error: {
          type: errorType,
          message: errorMessage,
          originalError: error.message
        },
        status: 'error',
        score: 0,
        analyzedAt: new Date().toISOString()
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
        const linkUrl = new URL(href, normalizedUrl);
        const hasNofollow = $(el).attr('rel')?.includes('nofollow') || false;
        
        if (linkUrl.hostname === new URL(normalizedUrl).hostname) {
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
    
    // Build the result object
    const result = {
      url: normalizedUrl,
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
      timestamp: new Date().toISOString(),
      analyzedAt: new Date().toISOString()
    };
    
    // Cache the result in Redis
    if (redis.isRedisConfigured) {
      try {
        const cacheKey = generateUrlCacheKey(normalizedUrl);
        await redis.setCache(cacheKey, result, 86400); // Cache for 24 hours
        console.log(`Cached results for ${normalizedUrl}`);
      } catch (error) {
        console.error('Error caching results:', error);
        // Continue without caching if it fails
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error analyzing SEO for ${normalizedUrl}:`, error);
    
    // Return structured error response
    return {
      url: normalizedUrl,
      score: 0,
      status: 'error',
      error: {
        type: 'analysis_error',
        message: 'Failed to analyze SEO for the provided URL',
        details: error.toString()
      },
      timestamp: new Date().toISOString(),
      analyzedAt: new Date().toISOString()
    };
  }
}

/**
 * Handle batch SEO analysis
 * @param {Object} req Express request
 * @param {Object} res Express response
 */
async function handleBatchAudit(req, res) {
  try {
    // Extract URLs from request body
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide an array of URLs to analyze',
        timestamp: new Date().toISOString()
      });
    }
    
    // Limit the number of URLs to prevent abuse
    const MAX_URLS = 20;
    const urlsToProcess = urls.slice(0, MAX_URLS);
    
    // Normalize URLs
    const normalizedUrls = urlsToProcess.map(url => normalizeUrl(url));
    
    // Check for cached batch result
    let cachedBatchResult = null;
    if (redis.isRedisConfigured) {
      try {
        const batchCacheKey = generateBatchCacheKey(normalizedUrls);
        console.log(`Checking batch cache for key: ${batchCacheKey}`);
        
        cachedBatchResult = await redis.getCache(batchCacheKey);
        
        if (cachedBatchResult) {
          console.log(`Batch cache hit for ${normalizedUrls.length} URLs`);
          return res.status(200).json({
            status: 'success',
            message: 'Batch SEO analysis retrieved from cache',
            totalUrls: normalizedUrls.length,
            timestamp: new Date().toISOString(),
            cached: true,
            cachedAt: cachedBatchResult.timestamp || new Date().toISOString(),
            results: cachedBatchResult.results
          });
        }
        
        console.log(`Batch cache miss, performing analysis`);
      } catch (error) {
        console.error('Error checking batch cache:', error);
        // Continue with analysis if cache check fails
      }
    }
    
    // Try to get individual cached results first to avoid unnecessary network requests
    const batchResults = [];
    const uncachedUrls = [];
    
    if (redis.isRedisConfigured) {
      for (const url of normalizedUrls) {
        try {
          const cacheKey = generateUrlCacheKey(url);
          const cachedResult = await redis.getCache(cacheKey);
          
          if (cachedResult) {
            console.log(`Individual cache hit for ${url}`);
            batchResults.push({
              ...cachedResult,
              cached: true,
              cachedAt: cachedResult.timestamp || new Date().toISOString()
            });
          } else {
            uncachedUrls.push(url);
          }
        } catch (error) {
          console.error(`Error checking cache for ${url}:`, error);
          uncachedUrls.push(url);
        }
      }
    } else {
      // If Redis is not configured, process all URLs
      uncachedUrls.push(...normalizedUrls);
    }
    
    console.log(`Processing ${uncachedUrls.length} uncached URLs out of ${normalizedUrls.length} total URLs`);
    
    // Process uncached URLs in parallel with rate limiting
    // Limit to 5 concurrent requests to avoid overwhelming the servers
    const concurrencyLimit = 5;
    
    // Split into chunks and process sequentially to avoid overwhelming servers
    for (let i = 0; i < uncachedUrls.length; i += concurrencyLimit) {
      const chunk = uncachedUrls.slice(i, i + concurrencyLimit);
      
      // Process this chunk in parallel
      const chunkPromises = chunk.map(url => analyzeSingleUrl(url));
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      // Add results to batch results
      for (let j = 0; j < chunkResults.length; j++) {
        const result = chunkResults[j];
        if (result.status === 'fulfilled') {
          batchResults.push(result.value);
        } else {
          // Handle rejected promises
          batchResults.push({
            url: chunk[j],
            score: 0,
            status: 'error',
            error: {
              type: 'analysis_error',
              message: 'Analysis failed',
              details: result.reason?.toString() || 'Unknown error'
            },
            timestamp: new Date().toISOString(),
            analyzedAt: new Date().toISOString()
          });
        }
      }
    }
    
    // Cache the batch result for future use
    if (redis.isRedisConfigured) {
      try {
        const batchCacheKey = generateBatchCacheKey(normalizedUrls);
        await redis.setCache(batchCacheKey, {
          timestamp: new Date().toISOString(),
          results: batchResults
        }, 86400); // Cache for 24 hours
        console.log(`Cached batch results for ${normalizedUrls.length} URLs`);
      } catch (error) {
        console.error('Error caching batch results:', error);
        // Continue without caching if it fails
      }
    }
    
    // Return the combined results
    return res.status(200).json({
      status: 'success',
      message: 'Batch SEO analysis completed',
      totalUrls: normalizedUrls.length,
      timestamp: new Date().toISOString(),
      cached: false,
      results: batchResults
    });
  } catch (error) {
    console.error('Error handling batch audit:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to perform batch SEO analysis',
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = handleBatchAudit;