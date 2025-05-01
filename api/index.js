// Consolidated API endpoint for all SEO audit operations
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
  console.log("Redis client initialized successfully");
} catch (error) {
  console.error('Failed to initialize Redis:', error);
}

// Key prefixes and TTLs
const keys = {
  jobPrefix: 'job:',
  queueKey: 'audit:queue',
  processingQueueKey: 'audit:processing',
  cachePrefix: 'audit:',
};

// Cache TTLs based on content volatility
const TTLs = {
  page: 3600,       // 1 hour
  site: 14400,      // 4 hours
  analyze: 900,     // 15 minutes
  health: 60        // 1 minute
};

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
 * Get cached data with standardized key format
 */
async function getCachedData(type, urlString, keyword = '') {
  try {
    const normalizedUrl = normalizeUrl(urlString);
    const cacheKey = `${keys.cachePrefix}${type}:${normalizedUrl}${keyword ? `:${keyword}` : ''}`;
    
    const cachedData = await redis.get(cacheKey);
    
    if (!cachedData) {
      return null;
    }
    
    // Parse the cached data if it's a string
    if (typeof cachedData === 'string') {
      try {
        return JSON.parse(cachedData);
      } catch (e) {
        console.error(`Error parsing cached data for ${cacheKey}:`, e);
        return null;
      }
    }
    
    return cachedData;
  } catch (error) {
    console.error(`Error getting cached data for ${urlString}:`, error);
    return null;
  }
}

/**
 * Cache data with standardized key format
 */
async function cacheData(type, urlString, data, ttl, keyword = '') {
  try {
    const normalizedUrl = normalizeUrl(urlString);
    const cacheKey = `${keys.cachePrefix}${type}:${normalizedUrl}${keyword ? `:${keyword}` : ''}`;
    
    // Add cached metadata
    const cachedData = {
      ...data,
      cached: true,
      cachedAt: Date.now(),
    };
    
    // Convert to JSON and store
    const serialized = JSON.stringify(cachedData);
    await redis.set(cacheKey, serialized, { ex: ttl || TTLs[type] || 3600 });
    return true;
  } catch (error) {
    console.error(`Error caching data for ${urlString}:`, error);
    return false;
  }
}

/**
 * Create a job
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
 * Get a job by ID
 */
async function getJob(jobId) {
  try {
    const jobKey = `${keys.jobPrefix}${jobId}`;
    const jobData = await redis.get(jobKey);
    
    if (!jobData) {
      return null;
    }
    
    return typeof jobData === 'string' ? JSON.parse(jobData) : jobData;
  } catch (error) {
    console.error(`Error getting job ${jobId}:`, error);
    return null;
  }
}

/**
 * Update a job
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
    const job = typeof jobData === 'string' ? JSON.parse(jobData) : jobData;
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
    return false;
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
 * Handler for page audit endpoint
 */
async function handlePageAudit(req, res) {
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
    
    // Get URL from request body
    const { url, options } = requestBody;
    
    if (!url) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'URL is required',
        timestamp: new Date().toISOString()
      });
    }

    // Validate URL format
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    try {
      new URL(normalizedUrl);
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid URL provided',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check cache first
    const urlKey = normalizeUrl(normalizedUrl);
    const cachedData = await getCachedData('page', urlKey);
    
    if (cachedData) {
      console.log(`Serving cached page audit for ${url}`);
      return res.status(200).json({
        status: 'ok',
        message: 'Page audit results retrieved from cache',
        jobId: cachedData.jobId || 'cached',
        url: normalizedUrl,
        cached: true,
        cachedAt: cachedData.cachedAt,
        timestamp: new Date().toISOString(),
        data: cachedData
      });
    }
    
    // Create a job ID
    const jobId = await createJob({
      type: 'page_audit',
      params: {
        url: normalizedUrl,
        options: options || {},
      },
      status: 'queued',
      progress: 0,
      createdAt: Date.now()
    });
    
    // Return job ID to client
    return res.status(202).json({
      status: 'ok',
      message: 'Page audit job created',
      jobId,
      url: normalizedUrl,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating page audit job:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create page audit job',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handler for site audit endpoint
 */
async function handleSiteAudit(req, res) {
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
    
    // Get URL from request body
    const { url, options = {} } = requestBody;
    
    if (!url) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'URL is required',
        timestamp: new Date().toISOString()
      });
    }

    // Validate URL format
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    try {
      new URL(normalizedUrl);
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid URL provided',
        timestamp: new Date().toISOString()
      });
    }
    
    // Set default options
    const siteOptions = {
      maxPages: Math.min(options.maxPages || 10, 100), // Max 100 pages
      crawlDepth: Math.min(options.crawlDepth || 2, 5), // Max depth 5
      ...options
    };
    
    // Create cache key based on URL and options
    const urlKey = normalizeUrl(normalizedUrl);
    const cacheKey = `${urlKey}:max${siteOptions.maxPages}:depth${siteOptions.crawlDepth}`;
    
    // Check cache first
    const cachedData = await getCachedData('site', cacheKey);
    
    if (cachedData) {
      console.log(`Serving cached site audit for ${url}`);
      return res.status(200).json({
        status: 'ok',
        message: 'Site audit results retrieved from cache',
        jobId: cachedData.jobId || 'cached',
        url: normalizedUrl,
        cached: true,
        cachedAt: cachedData.cachedAt,
        timestamp: new Date().toISOString(),
        data: cachedData
      });
    }
    
    // Create a job ID
    const jobId = await createJob({
      type: 'site_audit',
      params: {
        url: normalizedUrl,
        options: siteOptions,
      },
      status: 'queued',
      progress: 0,
      createdAt: Date.now()
    });
    
    // Return job ID to client
    return res.status(202).json({
      status: 'ok',
      message: 'Site audit job created',
      jobId,
      url: normalizedUrl,
      options: siteOptions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating site audit job:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create site audit job',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handler for job status endpoint
 */
async function handleJobStatus(req, res, jobId) {
  try {
    if (!jobId) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Job ID is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Get job details
    const job = await getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: `Job with ID ${jobId} not found`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Return job status
    return res.status(200).json({
      status: 'ok',
      message: `Job status retrieved`,
      jobId,
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress || 0,
        createdAt: job.created,
        updatedAt: job.updated,
        url: job.params?.url,
        options: job.params?.options || {},
        message: job.message
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error fetching job status:`, error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch job status',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handler for job results endpoint
 */
async function handleJobResults(req, res, jobId) {
  try {
    if (!jobId) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Job ID is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Get job details
    const job = await getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: `Job with ID ${jobId} not found`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if job is completed
    if (job.status !== 'completed') {
      return res.status(400).json({
        status: 'error',
        message: `Job with ID ${jobId} is not completed (current status: ${job.status})`,
        job: {
          id: job.id,
          type: job.type,
          status: job.status,
          progress: job.progress || 0,
          createdAt: job.created,
          updatedAt: job.updated
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Return job results
    return res.status(200).json({
      status: 'ok',
      message: 'Job results retrieved',
      jobId,
      url: job.params?.url,
      results: job.results || {},
      cached: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error fetching job results:`, error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch job results',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handler for SEO analysis endpoint
 */
async function analyzeSeo(urlString) {
  try {
    console.log(`Analyzing SEO for ${urlString}`);
    
    // Fetch the page
    const response = await axios.get(urlString, {
      timeout: 15000,
      headers: {
        'User-Agent': 'MardenSEOAuditBot/1.0 (+https://audit.mardenseo.com)'
      }
    });
    
    // Load content into cheerio
    const $ = cheerio.load(response.data);
    
    // Extract key SEO elements
    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const h1Text = $('h1').first().text().trim();
    const h1Count = $('h1').length;
    const h2Count = $('h2').length;
    const canonicalTag = $('link[rel="canonical"]').attr('href') || '';
    const robotsTag = $('meta[name="robots"]').attr('content') || '';
    
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
    
    // Extract images without alt text
    const imagesWithoutAlt = [];
    $('img').each((i, el) => {
      const alt = $(el).attr('alt');
      const src = $(el).attr('src');
      if (!alt && src) {
        imagesWithoutAlt.push(src);
      }
    });
    
    // Count links
    const links = {
      internal: 0,
      external: 0,
      total: 0
    };
    
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        return;
      }
      
      try {
        const linkUrl = new URL(href, urlString);
        
        if (linkUrl.hostname === new URL(urlString).hostname) {
          links.internal++;
        } else {
          links.external++;
        }
        
        links.total++;
      } catch (error) {
        // Skip malformed URLs
      }
    });
    
    // Calculate content statistics
    let contentText = $('body').text().trim();
    contentText = contentText.replace(/\\s+/g, ' ');
    const wordCount = contentText.split(/\\s+/).length;
    const contentLength = contentText.length;
    
    // Check for structured data
    const structuredData = [];
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const jsonText = $(el).html();
        const json = JSON.parse(jsonText);
        structuredData.push({
          type: json['@type'] || 'Unknown',
          data: json
        });
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    // Check for schema.org microdata
    const hasMicrodata = $('[itemscope]').length > 0;
    
    // Calculate score based on factors
    let score = 100;
    const issues = [];
    
    // Title checks
    if (!title) {
      score -= 20;
      issues.push({
        type: 'missing_title',
        severity: 'critical',
        recommendation: 'Add a title tag to your page'
      });
    } else if (title.length < 30) {
      score -= 10;
      issues.push({
        type: 'title_too_short',
        severity: 'warning',
        current: title,
        recommendation: 'Make your title tag longer (30-60 characters recommended)'
      });
    } else if (title.length > 60) {
      score -= 5;
      issues.push({
        type: 'title_too_long',
        severity: 'info',
        current: title,
        recommendation: 'Consider shortening your title tag (30-60 characters recommended)'
      });
    }
    
    // Meta description checks
    if (!metaDescription) {
      score -= 15;
      issues.push({
        type: 'missing_meta_description',
        severity: 'critical',
        recommendation: 'Add a meta description to your page'
      });
    } else if (metaDescription.length < 50) {
      score -= 10;
      issues.push({
        type: 'meta_description_too_short',
        severity: 'warning',
        current: metaDescription,
        recommendation: 'Make your meta description longer (50-160 characters recommended)'
      });
    } else if (metaDescription.length > 160) {
      score -= 5;
      issues.push({
        type: 'meta_description_too_long',
        severity: 'info',
        current: metaDescription,
        recommendation: 'Consider shortening your meta description (50-160 characters recommended)'
      });
    }
    
    // H1 checks
    if (h1Count === 0) {
      score -= 15;
      issues.push({
        type: 'missing_h1',
        severity: 'critical',
        recommendation: 'Add an H1 heading to your page'
      });
    } else if (h1Count > 1) {
      score -= 10;
      issues.push({
        type: 'multiple_h1',
        severity: 'warning',
        current: h1Count,
        recommendation: 'Use only one H1 heading per page'
      });
    }
    
    // Content length check
    if (wordCount < 300) {
      score -= 10;
      issues.push({
        type: 'thin_content',
        severity: 'warning',
        current: wordCount,
        recommendation: 'Add more content to your page (aim for at least 300 words)'
      });
    }
    
    // Image alt text check
    if (imagesWithoutAlt.length > 0) {
      score -= Math.min(15, imagesWithoutAlt.length * 3);
      issues.push({
        type: 'images_missing_alt',
        severity: 'warning',
        count: imagesWithoutAlt.length,
        recommendation: 'Add alt text to all images for better accessibility and SEO'
      });
    }
    
    // Canonical check
    if (!canonicalTag) {
      score -= 5;
      issues.push({
        type: 'missing_canonical',
        severity: 'info',
        recommendation: 'Add a canonical tag to indicate the preferred version of this page'
      });
    }
    
    // Structured data check
    if (structuredData.length === 0 && !hasMicrodata) {
      score -= 5;
      issues.push({
        type: 'no_structured_data',
        severity: 'info',
        recommendation: 'Add structured data to help search engines understand your content'
      });
    }
    
    // Ensure score stays within 0-100 range
    score = Math.max(0, Math.min(100, score));
    
    // Determine overall status
    let status = 'good';
    if (score < 50) {
      status = 'poor';
    } else if (score < 80) {
      status = 'needs_improvement';
    }
    
    // Return analysis results
    return {
      url: urlString,
      score,
      status,
      issues,
      metadata: {
        title: {
          text: title,
          length: title.length
        },
        metaDescription: {
          text: metaDescription,
          length: metaDescription.length
        },
        canonical: canonicalTag,
        robots: robotsTag
      },
      content: {
        wordCount,
        contentLength,
        headings,
        links,
        imagesWithoutAlt: imagesWithoutAlt.length
      },
      technical: {
        hasStructuredData: structuredData.length > 0 || hasMicrodata,
        structuredDataTypes: structuredData.map(item => item.type)
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error analyzing SEO for ${urlString}:`, error);
    throw error;
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
    
    // Get URL from request body
    const { url } = requestBody;
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate URL format
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    try {
      new URL(normalizedUrl);
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid URL provided',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check cache first
    const urlKey = normalizeUrl(normalizedUrl);
    const cachedData = await getCachedData('analyze', urlKey);
    
    if (cachedData) {
      console.log(`Serving cached SEO analysis for ${url}`);
      return res.status(200).json({
        status: 'ok',
        message: 'SEO analysis retrieved from cache',
        url: normalizedUrl,
        cached: true,
        cachedAt: cachedData.cachedAt,
        timestamp: new Date().toISOString(),
        data: cachedData
      });
    }
    
    // Perform analysis
    console.log(`Performing SEO analysis for ${normalizedUrl}`);
    const analysisResults = await analyzeSeo(normalizedUrl);
    
    // Cache results (15 minutes TTL per requirement #8)
    await cacheData('analyze', urlKey, analysisResults, TTLs.analyze);
    
    // Return analysis results
    return res.status(200).json({
      status: 'ok',
      message: 'SEO analysis completed',
      url: normalizedUrl,
      cached: false,
      timestamp: new Date().toISOString(),
      data: analysisResults
    });
  } catch (error) {
    console.error('Error performing SEO analysis:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to perform SEO analysis',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Process a job
 */
async function processJob(jobId) {
  try {
    // Get job data
    const job = await getJob(jobId);
    
    if (!job) {
      console.error(`Job ${jobId} not found`);
      return false;
    }
    
    // Update job status to processing
    await updateJob(jobId, {
      status: 'processing',
      progress: 10,
      message: 'Job processing started'
    });
    
    console.log(`Processing job ${jobId} of type ${job.type}`);
    
    // Process based on job type
    let result = null;
    
    if (job.type === 'page_audit') {
      // For page audit, we'll perform SEO analysis for now
      // In a full implementation, this would be more comprehensive
      await updateJob(jobId, {
        progress: 30,
        message: 'Analyzing page content'
      });
      
      result = await analyzeSeo(job.params.url);
      
      // Cache the results
      await cacheData('page', job.params.url, result, TTLs.page);
    } else if (job.type === 'site_audit') {
      // For site audit, we'll just analyze the main page for now
      // In a full implementation, this would crawl and analyze multiple pages
      await updateJob(jobId, {
        progress: 30,
        message: 'Analyzing main page'
      });
      
      const pageResult = await analyzeSeo(job.params.url);
      
      // Create a simplified site result
      result = {
        url: job.params.url,
        mainPageScore: pageResult.score,
        mainPageStatus: pageResult.status,
        siteAnalysis: {
          pagesAnalyzed: 1,
          averageScore: pageResult.score,
          mainPage: pageResult
        },
        timestamp: new Date().toISOString()
      };
      
      // Cache the results
      const cacheKey = `${normalizeUrl(job.params.url)}:max${job.params.options?.maxPages || 10}:depth${job.params.options?.crawlDepth || 2}`;
      await cacheData('site', cacheKey, result, TTLs.site);
    } else {
      console.error(`Unknown job type: ${job.type}`);
      await updateJob(jobId, {
        status: 'failed',
        error: `Unknown job type: ${job.type}`,
        message: 'Job failed - unknown type'
      });
      return false;
    }
    
    // Update job with results
    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      results: result,
      completed: Date.now(),
      message: 'Job completed successfully'
    });
    
    return true;
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    
    // Update job with error
    try {
      await updateJob(jobId, {
        status: 'failed',
        error: error.message,
        message: 'Job processing failed'
      });
    } catch (updateError) {
      console.error(`Failed to update job ${jobId} after error:`, updateError);
    }
    
    return false;
  }
}

/**
 * Get next job from queue
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
    return null;
  }
}

/**
 * Process jobs from queue
 */
async function processQueue() {
  try {
    // Get next job from queue
    const jobId = await getNextJob();
    
    if (jobId) {
      console.log(`Processing job ${jobId} from queue`);
      await processJob(jobId);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error processing job queue:', error);
    return false;
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
    
    // Process one job from the queue in the background
    setTimeout(() => {
      processQueue().catch(error => {
        console.error('Error processing queue:', error);
      });
    }, 10);
    
    // Route based on path
    if (path === '/v2/health' || path === '/health') {
      return await handleHealthCheck(req, res);
    } else if (path === '/v2/audit/page' || path === '/audit/page') {
      return await handlePageAudit(req, res);
    } else if (path === '/v2/audit/site' || path === '/audit/site') {
      return await handleSiteAudit(req, res);
    } else if (path === '/v2/seo-analyze' || path === '/seo-analyze') {
      return await handleSeoAnalyze(req, res);
    } else if (path.match(/^\/?v2?\/job\/([^\/]+)\/results\/?$/)) {
      const jobId = path.match(/^\/?v2?\/job\/([^\/]+)\/results\/?$/)[1];
      return await handleJobResults(req, res, jobId);
    } else if (path.match(/^\/?v2?\/job\/([^\/]+)\/?$/)) {
      const jobId = path.match(/^\/?v2?\/job\/([^\/]+)\/?$/)[1];
      return await handleJobStatus(req, res, jobId);
    } else if (path === '/api/real-seo-audit' || path === '/real-seo-audit') {
      // Legacy endpoint - redirect to SEO analyze
      return await handleSeoAnalyze(req, res);
    } else if (path === '/' || path === '' || path === '/api' || path === '/api/') {
      // Root path - return API info
      return res.status(200).json({
        status: 'ok',
        message: 'Marden SEO Audit API',
        version: 'v2',
        endpoints: [
          '/v2/health',
          '/v2/audit/page',
          '/v2/audit/site',
          '/v2/job/:jobId',
          '/v2/job/:jobId/results',
          '/v2/seo-analyze'
        ],
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
    
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};