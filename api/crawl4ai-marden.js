const axios = require('axios');
const cheerio = require('cheerio');
const redis = require('./lib/redis.optimized');

/**
 * Marden SEO Audit Tool - Enhanced Crawler Integration
 * This module integrates with Crawl4AI to provide advanced crawling capabilities
 */

// Configure the Crawl4AI endpoint
const CRAWL4AI_ENDPOINT = 'http://localhost:11235/crawl';

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
 * Request a crawl job from Crawl4AI
 * @param {string} url - The URL to crawl
 * @param {Object} options - Crawl options
 * @returns {Promise<Object>} - Crawl job details
 */
async function requestCrawl(url, options = {}) {
  try {
    console.log(`Requesting crawl for ${url} with options:`, options);
    
    // Set default options
    const crawlOptions = {
      url: normalizeUrl(url),
      maxPages: options.maxPages || 10,
      maxDepth: options.maxDepth || 2,
      respectRobots: options.respectRobots !== false,
      followLinks: options.followLinks !== false,
      timeout: options.timeout || 30000, // 30 seconds default
      userAgent: 'MardenSEO-Audit/1.0 (https://audit.mardenseo.com)',
      ...options
    };
    
    // Send request to Crawl4AI
    const response = await axios.post(CRAWL4AI_ENDPOINT, crawlOptions, {
      timeout: 10000 // 10 second timeout for the request itself
    });
    
    if (response.data && response.data.jobId) {
      console.log(`Crawl job created with ID: ${response.data.jobId}`);
      return response.data;
    } else {
      throw new Error('Invalid response from crawler service');
    }
  } catch (error) {
    console.error(`Error requesting crawl: ${error.message}`);
    throw error;
  }
}

/**
 * Check the status of a crawl job
 * @param {string} jobId - The crawl job ID
 * @returns {Promise<Object>} - Job status
 */
async function checkCrawlStatus(jobId) {
  try {
    const response = await axios.get(`${CRAWL4AI_ENDPOINT}/status/${jobId}`, {
      timeout: 5000
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error checking crawl status: ${error.message}`);
    throw error;
  }
}

/**
 * Get crawl results
 * @param {string} jobId - The crawl job ID
 * @returns {Promise<Object>} - Crawl results
 */
async function getCrawlResults(jobId) {
  try {
    const response = await axios.get(`${CRAWL4AI_ENDPOINT}/results/${jobId}`, {
      timeout: 10000
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error getting crawl results: ${error.message}`);
    throw error;
  }
}

/**
 * Wait for crawl job to complete with timeout
 * @param {string} jobId - The crawl job ID
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Object>} - Crawl results
 */
async function waitForCrawlCompletion(jobId, timeoutMs = 120000) {
  const startTime = Date.now();
  let status = 'pending';
  
  while (status !== 'completed' && status !== 'failed') {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Crawl timeout after ${timeoutMs}ms`);
    }
    
    // Wait 2 seconds between checks
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check status
    const statusResponse = await checkCrawlStatus(jobId);
    status = statusResponse.status;
    
    console.log(`Crawl job ${jobId} status: ${status}, progress: ${statusResponse.progress || 0}%`);
    
    if (status === 'failed') {
      throw new Error(`Crawl failed: ${statusResponse.error || 'Unknown error'}`);
    }
    
    if (status === 'completed') {
      return await getCrawlResults(jobId);
    }
  }
}

/**
 * Perform comprehensive site crawl and analysis
 * @param {string} url - The URL to crawl
 * @param {Object} options - Crawl and analysis options
 * @returns {Promise<Object>} - Analysis results
 */
async function crawlAndAnalyzeSite(url, options = {}) {
  console.log(`Starting enhanced site crawl for ${url}`);
  const startTime = Date.now();
  
  try {
    // Check cache first
    const normalizedUrl = normalizeUrl(url);
    const cacheKey = `marden-crawler:${normalizedUrl}`;
    
    if (options.useCache !== false) {
      try {
        const cachedResult = await redis.getCache(cacheKey);
        if (cachedResult) {
          console.log(`Cache hit for ${normalizedUrl}`);
          return {
            ...cachedResult.data,
            cached: true,
            cachedAt: cachedResult.timestamp
          };
        }
      } catch (cacheError) {
        console.warn(`Cache check failed: ${cacheError.message}`);
      }
    }
    
    // Request the crawl
    const crawlJob = await requestCrawl(normalizedUrl, {
      maxPages: options.maxPages || 10,
      maxDepth: options.maxDepth || 2,
      respectRobots: options.respectRobots !== false,
      followExternalLinks: false, // Only crawl within the same domain
      includeResources: true,     // Include JS, CSS, images
      screenshotPages: false,     // Don't take screenshots to save resources
      deviceType: 'desktop',      // Use desktop device for crawling
      ...options
    });
    
    // Wait for crawl to complete
    const crawlResults = await waitForCrawlCompletion(crawlJob.jobId, 180000); // 3 minute timeout
    
    // Process and analyze the crawl results
    const analysisResults = await processAndAnalyzeResults(normalizedUrl, crawlResults);
    
    // Cache the results
    try {
      await redis.setCache(cacheKey, {
        data: analysisResults,
        timestamp: new Date().toISOString()
      }, 86400); // 24 hour cache
    } catch (cacheError) {
      console.warn(`Failed to cache results: ${cacheError.message}`);
    }
    
    // Calculate total time
    const totalTime = Date.now() - startTime;
    
    return {
      ...analysisResults,
      processingTime: totalTime,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Enhanced crawl failed: ${error.message}`);
    throw error;
  }
}

/**
 * Process and analyze crawl results
 * @param {string} baseUrl - The original URL
 * @param {Object} crawlResults - Raw crawl results
 * @returns {Promise<Object>} - Analyzed results
 */
async function processAndAnalyzeResults(baseUrl, crawlResults) {
  const pages = crawlResults.pages || [];
  const pageCount = pages.length;
  
  console.log(`Processing ${pageCount} crawled pages`);
  
  // Collect overall statistics
  let totalScore = 0;
  let totalIssues = 0;
  let criticalIssues = 0;
  
  // Collect discovered issues
  const allIssues = {};
  
  // Process each page
  const analyzedPages = await Promise.all(pages.map(async page => {
    try {
      // Analyze the page
      const analysis = await analyzePage(page);
      
      // Update totals
      totalScore += analysis.score || 0;
      totalIssues += analysis.totalIssuesCount || 0;
      criticalIssues += analysis.criticalIssuesCount || 0;
      
      // Collect issues
      if (analysis.issues) {
        analysis.issues.forEach(issue => {
          if (!allIssues[issue.type]) {
            allIssues[issue.type] = {
              count: 0,
              pages: [],
              severity: issue.severity,
              recommendation: issue.recommendation
            };
          }
          
          allIssues[issue.type].count++;
          allIssues[issue.type].pages.push(page.url);
        });
      }
      
      return {
        url: page.url,
        title: analysis.title,
        score: analysis.score,
        status: analysis.status,
        issuesCount: analysis.totalIssuesCount,
        criticalIssuesCount: analysis.criticalIssuesCount
      };
    } catch (error) {
      console.error(`Error analyzing page ${page.url}: ${error.message}`);
      return {
        url: page.url,
        error: error.message,
        score: 0,
        status: 'error'
      };
    }
  }));
  
  // Calculate average score
  const averageScore = pageCount > 0 ? Math.round(totalScore / pageCount) : 0;
  
  // Determine overall status
  let siteStatus = 'unknown';
  if (averageScore >= 80) siteStatus = 'good';
  else if (averageScore >= 50) siteStatus = 'needs_improvement';
  else if (averageScore > 0) siteStatus = 'poor';
  
  // Create site analysis summary
  const analysis = {
    baseUrl,
    siteScore: averageScore,
    siteStatus,
    pageCount,
    totalIssuesCount: totalIssues,
    criticalIssuesCount: criticalIssues,
    commonIssues: Object.entries(allIssues)
      .map(([type, data]) => ({
        type,
        count: data.count,
        severity: data.severity,
        recommendation: data.recommendation,
        affectedPages: data.pages.length,
        pageExamples: data.pages.slice(0, 3) // First 3 examples
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10), // Top 10 issues
    pages: analyzedPages,
    crawlMetrics: {
      pagesDiscovered: crawlResults.discovered || pageCount,
      pagesCrawled: pageCount,
      crawlTime: crawlResults.crawlTime || 0,
      crawlDepth: crawlResults.maxDepthReached || 0
    }
  };
  
  return analysis;
}

/**
 * Analyze a single page from crawl results
 * @param {Object} page - The page data from crawler
 * @returns {Promise<Object>} - Page analysis
 */
async function analyzePage(page) {
  const $ = cheerio.load(page.content);
  
  // Extract basic SEO elements
  const title = $('title').text().trim();
  const metaDescription = $('meta[name="description"]').attr('content') || '';
  
  // Heading analysis
  const h1Elements = $('h1');
  const h1Count = h1Elements.length;
  const h1Texts = [];
  h1Elements.each((i, el) => {
    const text = $(el).text().trim();
    if (text) h1Texts.push(text);
  });
  
  const h2Elements = $('h2');
  const h2Count = h2Elements.length;
  
  // Image analysis
  const images = $('img');
  const imageCount = images.length;
  let imagesWithoutAlt = 0;
  images.each((i, el) => {
    if (!$(el).attr('alt')) {
      imagesWithoutAlt++;
    }
  });
  
  // Links analysis
  const links = $('a[href]');
  let internalLinks = 0;
  let externalLinks = 0;
  links.each((i, el) => {
    try {
      const href = $(el).attr('href');
      if (!href) return;
      
      // Skip anchor, javascript, mailto links
      if (href.startsWith('#') || href.startsWith('javascript:') || 
          href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      
      // Parse URL to check if internal or external
      const linkUrl = new URL(href, page.url);
      const pageUrl = new URL(page.url);
      
      if (linkUrl.hostname === pageUrl.hostname) {
        internalLinks++;
      } else {
        externalLinks++;
      }
    } catch (e) {
      // Skip invalid URLs
    }
  });
  
  // Content analysis
  const bodyText = $('body').text().replace(/\\s+/g, ' ').trim();
  const wordCount = bodyText.split(/\\s+/).length;
  
  // Canonical URL
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  
  // Mobile responsiveness
  const hasViewport = $('meta[name="viewport"]').length > 0;
  
  // Schema.org structured data
  const hasStructuredData = $('script[type="application/ld+json"]').length > 0;
  
  // Core Web Vitals (estimated from crawler metrics)
  const perfMetrics = {
    lcp: page.metrics?.largestContentfulPaint || 2.5,
    cls: page.metrics?.cumulativeLayoutShift || 0.15,
    fid: page.metrics?.firstInputDelay || 180
  };
  
  // Calculate score based on factors
  let score = 70; // Default score
  const issues = [];
  
  // Title check
  if (!title) {
    score -= 20;
    issues.push({
      type: 'missing_title',
      severity: 'critical',
      impact: 'high',
      recommendation: 'Add a title tag to improve SEO'
    });
  } else if (title.length < 30) {
    score -= 10;
    issues.push({
      type: 'short_title',
      severity: 'warning',
      impact: 'medium',
      recommendation: 'Increase title length to 30-60 characters'
    });
  } else if (title.length > 70) {
    score -= 5;
    issues.push({
      type: 'long_title',
      severity: 'info',
      impact: 'low',
      recommendation: 'Consider shortening title to under 70 characters'
    });
  }
  
  // Meta description check
  if (!metaDescription) {
    score -= 15;
    issues.push({
      type: 'missing_meta_description',
      severity: 'critical',
      impact: 'high',
      recommendation: 'Add a meta description tag'
    });
  } else if (metaDescription.length < 80) {
    score -= 5;
    issues.push({
      type: 'short_meta_description',
      severity: 'warning',
      impact: 'medium',
      recommendation: 'Increase meta description length to 80-160 characters'
    });
  } else if (metaDescription.length > 160) {
    score -= 3;
    issues.push({
      type: 'long_meta_description',
      severity: 'info',
      impact: 'low',
      recommendation: 'Consider shortening meta description to 160 characters or less'
    });
  }
  
  // H1 check
  if (h1Count === 0) {
    score -= 15;
    issues.push({
      type: 'missing_h1',
      severity: 'critical',
      impact: 'high',
      recommendation: 'Add an H1 heading to your page'
    });
  } else if (h1Count > 1) {
    score -= 5;
    issues.push({
      type: 'multiple_h1',
      severity: 'warning',
      impact: 'medium',
      recommendation: 'Use only one H1 heading per page'
    });
  }
  
  // Images without alt text
  if (imagesWithoutAlt > 0) {
    const penalty = Math.min(10, imagesWithoutAlt);
    score -= penalty;
    issues.push({
      type: 'images_missing_alt',
      severity: 'warning',
      impact: 'medium',
      recommendation: `Add alt text to ${imagesWithoutAlt} images`
    });
  }
  
  // Content length check
  if (wordCount < 300) {
    score -= 10;
    issues.push({
      type: 'thin_content',
      severity: 'warning',
      impact: 'medium',
      recommendation: 'Add more content to reach at least 300 words'
    });
  }
  
  // Mobile responsive check
  if (!hasViewport) {
    score -= 10;
    issues.push({
      type: 'missing_viewport',
      severity: 'critical',
      impact: 'high',
      recommendation: 'Add a viewport meta tag for mobile responsiveness'
    });
  }
  
  // Structured data check
  if (!hasStructuredData) {
    score -= 5;
    issues.push({
      type: 'missing_structured_data',
      severity: 'info',
      impact: 'medium',
      recommendation: 'Add schema.org structured data to improve search appearance'
    });
  }
  
  // Canonical URL check
  if (!canonical) {
    score -= 5;
    issues.push({
      type: 'missing_canonical',
      severity: 'info',
      impact: 'low',
      recommendation: 'Add a canonical URL to prevent duplicate content issues'
    });
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
  
  // Create result object
  return {
    url: page.url,
    title,
    score,
    status,
    issues,
    totalIssuesCount: issues.length,
    criticalIssuesCount: issues.filter(i => i.severity === 'critical').length,
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
        h1Texts,
        h2Count
      },
      images: {
        total: imageCount,
        withoutAlt: imagesWithoutAlt
      },
      links: {
        internal: internalLinks,
        external: externalLinks,
        total: internalLinks + externalLinks
      },
      content: {
        wordCount
      },
      technical: {
        hasCanonical: !!canonical,
        canonicalUrl: canonical,
        hasViewport,
        hasStructuredData
      },
      performance: {
        lcp: perfMetrics.lcp,
        cls: perfMetrics.cls,
        fid: perfMetrics.fid
      }
    }
  };
}

module.exports = {
  crawlAndAnalyzeSite,
  analyzePage
};