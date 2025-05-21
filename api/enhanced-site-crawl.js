/**
 * Enhanced Site Crawler Implementation
 * This module provides an optimized implementation of site crawling functionality
 */

// Import required dependencies
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const normalizeUrl = require('normalize-url');
const { URL } = require('url');
const redis = require('./lib/redis.optimized');

// In-memory cache for quick response
const memoryCache = new Map();
const MEMORY_CACHE_MAX_SIZE = 100;
const MEMORY_CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Helper function to extract all links from a page
 * @param {string} html The HTML content
 * @param {string} baseUrl The base URL for resolving relative URLs
 * @returns {string[]} Array of extracted and normalized URLs
 */
function extractLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const links = new Set();
  
  // Extract all links from anchor tags
  $('a[href]').each((i, el) => {
    const href = $(el).attr('href');
    
    try {
      // Normalize and resolve the URL
      const linkUrl = new URL(href, baseUrl);
      const normalizedLink = linkUrl.href;
      
      // Only add links from the same domain
      if (linkUrl.hostname === new URL(baseUrl).hostname) {
        links.add(normalizedLink);
      }
    } catch (e) {
      // Skip invalid URLs
    }
  });
  
  return Array.from(links);
}

/**
 * Analyze a single page
 * @param {string} url The URL to analyze
 * @param {Object} browser The Puppeteer browser instance
 * @returns {Object} Analysis results for the page
 */
async function analyzePage(url, browser) {
  try {
    console.log(`Analyzing page: ${url}`);
    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set timeout and navigational options
    page.setDefaultNavigationTimeout(30000);
    
    // Navigate to the page
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    // Get the page HTML
    const html = await page.content();
    
    // Extract basic SEO information
    const title = await page.title();
    const metaDescription = await page.$eval('meta[name="description"]', el => el.getAttribute('content')).catch(() => null);
    
    // Extract page metrics
    const metrics = await page.evaluate(() => {
      return {
        documentSize: document.documentElement.innerHTML.length,
        imagesCount: document.querySelectorAll('img').length,
        imagesWithoutAlt: Array.from(document.querySelectorAll('img')).filter(img => !img.alt).length,
        h1Count: document.querySelectorAll('h1').length,
        h2Count: document.querySelectorAll('h2').length
      };
    });
    
    // Extract links
    const links = extractLinks(html, url);
    
    // Close the page
    await page.close();
    
    // Return the analysis results
    return {
      url,
      title,
      metaDescription,
      metrics,
      links,
      analyzedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error analyzing page ${url}:`, error);
    return {
      url,
      error: error.message,
      analyzedAt: new Date().toISOString()
    };
  }
}/**
 * Crawl a site with specified options
 * @param {string} baseUrl The starting URL for crawling
 * @param {Object} options Crawling options
 * @returns {Object} Crawl results for the entire site
 */
async function crawlSite(baseUrl, options = {}) {
  // Normalize the base URL
  const normalizedBaseUrl = normalizeUrl(baseUrl);
  
  // Set default options
  const maxPages = options.maxPages || 10;
  const maxDepth = options.maxDepth || 2;
  const respectRobots = options.respectRobots !== false;
  
  console.log(`Starting site crawl for ${normalizedBaseUrl}`);
  console.log(`Options: maxPages=${maxPages}, maxDepth=${maxDepth}, respectRobots=${respectRobots}`);
  
  // Initialize crawl data structures
  const crawledUrls = new Set();
  const urlsToVisit = [{ url: normalizedBaseUrl, depth: 0 }];
  const pageData = [];
  const errors = [];
  const startTime = Date.now();
  
  // Launch a browser instance
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,800'
    ]
  });
  
  try {
    // Process URLs until we reach maxPages or run out of URLs
    while (urlsToVisit.length > 0 && pageData.length < maxPages) {
      // Get the next URL to process
      const { url, depth } = urlsToVisit.shift();
      
      // Skip if already crawled
      if (crawledUrls.has(url)) {
        continue;
      }
      
      // Mark as crawled
      crawledUrls.add(url);
      
      // Analyze the page
      const analysisResult = await analyzePage(url, browser);
      pageData.push(analysisResult);
      
      // If we reached max depth, don't extract more links
      if (depth >= maxDepth) {
        continue;
      }
      
      // Add new links to visit
      if (analysisResult.links && !analysisResult.error) {
        for (const link of analysisResult.links) {
          // Skip links we've already crawled or queued
          if (!crawledUrls.has(link) && !urlsToVisit.some(item => item.url === link)) {
            urlsToVisit.push({ url: link, depth: depth + 1 });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error during site crawl:', error);
    errors.push({
      type: 'crawl_error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    // Close the browser
    await browser.close();
  }
  
  // Calculate the crawl time
  const crawlTime = Date.now() - startTime;
  
  // Prepare the result
  const result = {
    baseUrl: normalizedBaseUrl,
    crawlStats: {
      pagesAnalyzed: pageData.length,
      crawlTime,
      maxDepthReached: Math.max(...pageData.map(p => p.depth || 0), 0),
      uniqueUrls: crawledUrls.size,
      errors: errors.length
    },
    pages: pageData,
    errors,
    timestamp: new Date().toISOString()
  };
  
  return result;
}/**
 * Handle API requests for site crawling
 * @param {Object} req Express request object
 * @param {Object} res Express response object
 */
async function handleSiteCrawl(req, res) {
  // Start timer for performance measurement
  const startTime = Date.now();
  
  // Get the URL from request body or query params
  let url = '';
  let options = {};
  
  if (req.method === 'POST') {
    url = req.body.url;
    options = req.body.options || {};
  } else {
    url = req.query.url;
    options = {
      maxPages: req.query.maxPages ? parseInt(req.query.maxPages, 10) : 10,
      maxDepth: req.query.maxDepth ? parseInt(req.query.maxDepth, 10) : 2,
      respectRobots: req.query.respectRobots !== 'false'
    };
  }
  
  // Check if URL is provided
  if (!url) {
    return res.status(400).json({
      status: 'error',
      message: 'URL is required',
      timestamp: new Date().toISOString()
    });
  }
  
  // Normalize URL
  const normalizedUrl = normalizeUrl(url);
  
  // Generate cache key
  const cacheKey = `site-crawl:${normalizedUrl}:${options.maxPages || 10}:${options.maxDepth || 2}`;
  
  // Check memory cache first
  let memoryResult = null;
  if (memoryCache.has(cacheKey)) {
    const cached = memoryCache.get(cacheKey);
    if (Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
      memoryResult = cached.data;
      console.log(`Memory cache hit for site crawl: ${normalizedUrl}`);
    } else {
      // Expired cache entry, remove it
      memoryCache.delete(cacheKey);
    }
  }
  
  if (memoryResult) {
    return res.status(200).json({
      status: 'ok',
      message: 'Site crawl retrieved from memory cache',
      url: normalizedUrl,
      cached: true,
      cachedAt: new Date(memoryResult.timestamp).toISOString(),
      timestamp: new Date().toISOString(),
      data: memoryResult
    });
  }
  
  // Check Redis cache if no memory cache hit
  let cachedResult = null;
  if (redis.isRedisConfigured) {
    try {
      cachedResult = await redis.getCache(cacheKey);
      
      if (cachedResult) {
        console.log(`Redis cache hit for site crawl: ${normalizedUrl}`);
        
        // Also update memory cache
        if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
          // Remove oldest entry if at capacity
          const oldestKey = Array.from(memoryCache.keys())[0];
          memoryCache.delete(oldestKey);
        }
        memoryCache.set(cacheKey, {
          data: cachedResult,
          timestamp: Date.now()
        });
        
        return res.status(200).json({
          status: 'ok',
          message: 'Site crawl retrieved from cache',
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
  // Perform the site crawl
  try {
    console.log(`Performing site crawl for: ${normalizedUrl}`);
    const result = await crawlSite(normalizedUrl, options);
    
    // Update timestamp
    result.timestamp = new Date().toISOString();
    
    // Calculate execution time
    const executionTime = Date.now() - startTime;
    result.executionTime = executionTime;
    
    // Cache the result
    if (redis.isRedisConfigured) {
      try {
        // Cache in Redis first
        await redis.setCache(cacheKey, {
          data: result,
          timestamp: new Date().toISOString()
        }, 86400); // 24 hour TTL
        
        // Also update memory cache
        if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
          // Remove oldest entry if at capacity
          const oldestKey = Array.from(memoryCache.keys())[0];
          memoryCache.delete(oldestKey);
        }
        memoryCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      } catch (cacheError) {
        console.error('Error caching result:', cacheError);
      }
    }
    
    // Return the result
    return res.status(200).json({
      status: 'ok',
      message: 'Site crawl completed',
      url: normalizedUrl,
      cached: false,
      timestamp: new Date().toISOString(),
      executionTime,
      data: result
    });
  } catch (error) {
    console.error(`Error crawling site ${normalizedUrl}:`, error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Error performing site crawl',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      url: normalizedUrl,
      timestamp: new Date().toISOString()
    });
  }
}

// Export the handler function
module.exports = handleSiteCrawl;