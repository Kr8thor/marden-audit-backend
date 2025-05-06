/**
 * Enhanced Web Crawler for Site-wide SEO Analysis
 * Implements a robust crawling algorithm with proper URL normalization,
 * rate limiting, and full site analysis capabilities.
 */
const axios = require('axios');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const { URL } = require('url');

// Set default crawl settings
const DEFAULT_OPTIONS = {
  maxPages: 20,        // Maximum pages to crawl
  maxDepth: 3,         // Maximum link depth
  respectRobots: true, // Respect robots.txt rules
  delay: 1000,         // Delay between requests in milliseconds
  timeout: 30000,      // Request timeout in milliseconds
  concurrency: 3,      // Maximum concurrent requests
  userAgent: 'MardenSEOAuditBot/1.0', // User agent string
  ignoreQuery: true,   // Ignore query parameters in URLs
  maxRetries: 2,       // Maximum number of retries for failed requests
  followRedirects: true, // Follow redirects
  includeImages: true, // Include image analysis
  includeLinks: true,  // Include link analysis
};

/**
 * Normalize a URL to ensure proper format and consistent representation
 * @param {string} urlString - URL to normalize
 * @param {boolean} ignoreQuery - Whether to ignore query parameters
 * @returns {string} - Normalized URL
 */
function normalizeUrl(urlString, ignoreQuery = true) {
  try {
    // Parse URL with base if needed
    let parsedUrl = new URL(urlString);
    
    // Strip trailing slash
    let pathname = parsedUrl.pathname;
    if (pathname.endsWith('/') && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }
    
    // Rebuild URL without query parameters if ignoreQuery is true
    const normalized = new URL(
      pathname + (ignoreQuery ? '' : parsedUrl.search),
      `${parsedUrl.protocol}//${parsedUrl.host}`
    );
    
    return normalized.toString();
  } catch (error) {
    console.error(`Failed to normalize URL: ${urlString}`, error);
    return urlString; // Return original URL if normalization fails
  }
}

/**
 * Check if a URL should be crawled based on robots.txt
 * @param {string} url - URL to check
 * @param {object} robotsCache - Cache of robots.txt parsers
 * @param {string} userAgent - User agent string
 * @returns {Promise<boolean>} - Whether the URL should be crawled
 */
async function isAllowedByRobots(url, robotsCache, userAgent) {
  try {
    const parsedUrl = new URL(url);
    const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;
    
    // Check if robots.txt parser is cached
    if (!robotsCache[robotsUrl]) {
      try {
        // Fetch robots.txt with timeout
        const response = await axios.get(robotsUrl, { 
          timeout: 5000,
          headers: { 'User-Agent': userAgent }
        });
        
        // Parse robots.txt
        robotsCache[robotsUrl] = robotsParser(robotsUrl, response.data);
      } catch (error) {
        console.warn(`Failed to fetch robots.txt for ${parsedUrl.host}: ${error.message}`);
        // Assume allowed if robots.txt fails to load (common approach)
        robotsCache[robotsUrl] = {
          isAllowed: () => true
        };
      }
    }
    
    // Check if URL is allowed
    return robotsCache[robotsUrl].isAllowed(url, userAgent);
  } catch (error) {
    console.error(`Error checking robots.txt for ${url}: ${error.message}`);
    return true; // Assume allowed on error
  }
}

/**
 * Extract all links from a page
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {string} baseUrl - Base URL for resolving relative links
 * @returns {object} - Object with internal and external links
 */
function extractLinks($, baseUrl) {
  const parsedBaseUrl = new URL(baseUrl);
  const internalLinks = new Set();
  const externalLinks = new Set();
  
  // Extract all links
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
      return;
    }
    
    try {
      // Resolve relative URLs
      const resolvedUrl = new URL(href, baseUrl);
      
      // Check if the link is internal
      if (resolvedUrl.hostname === parsedBaseUrl.hostname) {
        internalLinks.add(resolvedUrl.toString());
      } else {
        externalLinks.add(resolvedUrl.toString());
      }
    } catch (error) {
      console.warn(`Invalid URL: ${href}`);
    }
  });
  
  return {
    internal: [...internalLinks],
    external: [...externalLinks]
  };
}

/**
 * Crawl a website and analyze all pages
 * @param {string} startUrl - URL to start crawling from
 * @param {object} options - Crawl options
 * @param {function} analyzePage - Function to analyze a page
 * @param {function} progressCallback - Callback for progress updates
 * @returns {Promise<object>} - Crawl results
 */
async function crawlSite(startUrl, options = {}, analyzePage, progressCallback = () => {}) {
  // Merge options with defaults
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  // Normalize start URL
  const normalizedStartUrl = normalizeUrl(startUrl, config.ignoreQuery);
  
  // Initialize state
  const urlsToCrawl = [{ url: normalizedStartUrl, depth: 0 }];
  const crawledUrls = new Set();
  const failedUrls = new Set();
  const robotsCache = {};
  const pageResults = [];
  const crawlStart = Date.now();
  
  let pagesDiscovered = 0;
  let pagesCrawled = 0;
  let maxDepthReached = 0;
  
  console.log(`Starting crawl of ${normalizedStartUrl} with max ${config.maxPages} pages at depth ${config.maxDepth}`);
  
  // Ensure analyzePage function exists
  if (typeof analyzePage !== 'function') {
    throw new Error('analyzePage function is required');
  }
  
  // Process the queue
  while (urlsToCrawl.length > 0 && pagesCrawled < config.maxPages) {
    // Process multiple pages in parallel (limited by concurrency)
    const batch = urlsToCrawl.splice(0, Math.min(config.concurrency, urlsToCrawl.length));
    
    // Update progress
    progressCallback({
      pagesDiscovered,
      pagesCrawled,
      maxDepthReached,
      remaining: urlsToCrawl.length,
      inProgress: batch.length,
      percentComplete: Math.min(100, Math.round((pagesCrawled / config.maxPages) * 100))
    });
    
    // Process batch in parallel
    const batchPromises = batch.map(async ({ url, depth }) => {
      // Track max depth
      maxDepthReached = Math.max(maxDepthReached, depth);
      
      // Mark as crawled to avoid duplicates
      crawledUrls.add(url);
      
      // Check robots.txt if enabled
      if (config.respectRobots) {
        const allowed = await isAllowedByRobots(url, robotsCache, config.userAgent);
        if (!allowed) {
          console.log(`Skipping ${url} - disallowed by robots.txt`);
          return null;
        }
      }
      
      try {
        // Fetch the page with retry logic
        let response = null;
        let retries = 0;
        
        while (retries <= config.maxRetries && !response) {
          try {
            response = await axios.get(url, {
              timeout: config.timeout,
              maxRedirects: config.followRedirects ? 5 : 0,
              headers: {
                'User-Agent': config.userAgent,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.5'
              }
            });
          } catch (error) {
            retries++;
            
            if (retries > config.maxRetries) {
              throw error;
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        // Parse the HTML
        const $ = cheerio.load(response.data);
        
        // Extract links
        const links = extractLinks($, url);
        
        // Analyze the page
        const analysisResult = await analyzePage(url, $, response);
        
        // Add result to pageResults
        pageResults.push({
          url,
          depth,
          ...analysisResult,
          linksFound: {
            internal: links.internal.length,
            external: links.external.length
          }
        });
        
        // Increment counters
        pagesCrawled++;
        
        // If we haven't reached max depth, add internal links to queue
        if (depth < config.maxDepth) {
          // Filter and normalize links
          const newLinks = links.internal
            .map(link => normalizeUrl(link, config.ignoreQuery))
            .filter(link => !crawledUrls.has(link) && !urlsToCrawl.some(item => item.url === link) && !failedUrls.has(link));
          
          // Add to queue
          for (const link of newLinks) {
            urlsToCrawl.push({ url: link, depth: depth + 1 });
            pagesDiscovered++;
          }
        }
        
        // Respect crawl delay
        await new Promise(resolve => setTimeout(resolve, config.delay));
        
        return { success: true, url };
      } catch (error) {
        // Track failed URLs
        failedUrls.add(url);
        
        console.error(`Failed to crawl ${url}: ${error.message}`);
        
        return { 
          success: false,
          url,
          error: error.message
        };
      }
    });
    
    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises);
    
    // Filter out null results (skipped due to robots.txt)
    const failedBatchUrls = batchResults
      .filter(result => result && !result.success)
      .map(result => result.url);
    
    // Track failures
    for (const failedUrl of failedBatchUrls) {
      failedUrls.add(failedUrl);
    }
  }
  
  // Calculate crawl duration
  const crawlEnd = Date.now();
  const crawlDuration = (crawlEnd - crawlStart) / 1000; // in seconds
  
  // Return results
  return {
    startUrl: normalizedStartUrl,
    results: pageResults,
    stats: {
      pagesDiscovered,
      pagesCrawled,
      pagesFailed: failedUrls.size,
      maxDepthReached,
      crawlDuration
    }
  };
}

module.exports = {
  crawlSite,
  normalizeUrl,
  DEFAULT_OPTIONS
};
