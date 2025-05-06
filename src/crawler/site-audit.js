/**
 * Site Audit - Combines site crawling with SEO analysis
 * Performs comprehensive site-wide SEO analysis
 */
const SiteCrawler = require('./site-crawler');
const url = require('url');

// Attempting to load the appropriate SEO analysis function with improved error handling
let analyzeSeoFunction;
try {
  // Try to find the batch audit module which should have the analysis function
  const batchAuditPath = '../../api/batch-audit-improved';
  const batchAuditModule = require(batchAuditPath);
  
  if (batchAuditModule && typeof batchAuditModule.analyzeSingleUrl === 'function') {
    analyzeSeoFunction = batchAuditModule.analyzeSingleUrl;
    console.log('SUCCESS: Loaded analyzeSingleUrl from batch-audit-improved.js');
  } else if (batchAuditModule && typeof batchAuditModule === 'function') {
    // The module itself might be the handler function
    analyzeSeoFunction = async (pageUrl) => {
      // Mock a request/response for the handler
      const req = { 
        body: { url: pageUrl },
        method: 'POST'
      };
      let responseData = null;
      const res = {
        status: () => res,
        json: (data) => { responseData = data; },
        send: (data) => { responseData = data; }
      };
      
      await batchAuditModule(req, res);
      
      if (responseData && responseData.data) {
        return responseData.data;
      } else {
        throw new Error('No data returned from batch audit module');
      }
    };
    console.log('SUCCESS: Created wrapper for batch-audit-improved.js handler');
  } else {
    throw new Error('No valid analysis function found in batch-audit-improved.js');
  }
} catch (firstError) {
  console.warn('WARN: Could not load from batch-audit-improved:', firstError.message);
  
  // Last resort - create a direct analysis function that uses fetch
  analyzeSeoFunction = async (pageUrl) => {
    console.log(`DIRECT ANALYSIS: Analyzing ${pageUrl} with direct fetch`);
    
    try {
      // Attempt to fetch and analyze the page directly
      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'MardenSEOAuditBot/1.0',
          'Accept': 'text/html,application/xhtml+xml'
        },
        timeout: 10000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const html = await response.text();
      
      // Very basic SEO analysis from the HTML content
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';
      
      const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) 
                            || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
      const description = descriptionMatch ? descriptionMatch[1].trim() : '';
      
      // Count headings
      const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
      const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
      const imgCount = (html.match(/<img[^>]*>/gi) || []).length;
      const imgWithoutAlt = (html.match(/<img[^>]*(?!alt=)[^>]*>/gi) || []).length;
      
      // Basic score calculation
      let score = 70;
      const issues = [];
      
      if (!title) {
        score -= 20;
        issues.push({ 
          type: "missing_title",
          severity: "critical",
          impact: "high",
          recommendation: "Add a title tag to your page"
        });
      } else if (title.length < 20) {
        score -= 10;
        issues.push({
          type: "title_too_short",
          severity: "warning",
          impact: "medium",
          recommendation: "Make your title tag longer (20-60 characters recommended)"
        });
      }
      
      if (!description) {
        score -= 15;
        issues.push({
          type: "missing_meta_description",
          severity: "critical",
          impact: "high",
          recommendation: "Add a meta description to your page"
        });
      }
      
      if (h1Count === 0) {
        score -= 15;
        issues.push({
          type: "missing_h1",
          severity: "critical",
          impact: "high",
          recommendation: "Add an H1 heading to your page"
        });
      }
      
      // Create properly structured categories as in the original API
      const categories = {
        metadata: { 
          score: title && description ? 80 : 50,
          issues: issues.filter(i => i.type.includes("title") || i.type.includes("description"))
        },
        content: { 
          score: h1Count === 1 ? 80 : 50,
          issues: issues.filter(i => i.type.includes("h1"))
        },
        technical: { 
          score: 70,
          issues: []
        },
        userExperience: { 
          score: 75,
          issues: []
        }
      };
      
      // Format the result like the actual SEO analysis
      return {
        url: pageUrl,
        score,
        status: score >= 80 ? 'good' : score >= 50 ? 'needs_improvement' : 'poor',
        criticalIssuesCount: issues.filter(i => i.severity === 'critical').length,
        totalIssuesCount: issues.length,
        categories,
        pageData: {
          title: { text: title, length: title.length },
          metaDescription: { text: description, length: description.length },
          headings: { h1Count, h2Count },
          images: { total: imgCount, withoutAlt: imgWithoutAlt },
          content: { wordCount: html.length / 6, contentLength: html.length }  // Rough estimate
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Direct analysis error for ${pageUrl}:`, error);
      return {
        url: pageUrl,
        score: 0,
        status: 'error',
        error: {
          message: `Analysis failed: ${error.message}`
        },
        timestamp: new Date().toISOString()
      };
    }
  };
  console.log('FALLBACK: Created direct analysis function that will analyze HTML');
}

/**
 * Redis client for caching site audit results
 */
let redis;
try {
  redis = require('../../api/lib/redis.optimized');
  console.log('Redis client imported successfully for site audit');
} catch (error) {
  console.warn('Redis client not available for site audit:', error.message);
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
 * Generate a cache key for site audit
 * @param {string} url Base URL of the site
 * @param {Object} options Audit options
 * @returns {string} Cache key
 */
function generateSiteAuditCacheKey(url, options = {}) {
  const normalizedUrl = normalizeUrl(url).toLowerCase();
  const maxPages = options.maxPages || 50;
  const maxDepth = options.maxDepth || 3;
  
  return `site-audit:${normalizedUrl}:p${maxPages}:d${maxDepth}`;
}

/**
 * Perform a comprehensive site audit
 * @param {string} siteUrl URL of the site to audit
 * @param {Object} options Audit options
 * @returns {Promise<Object>} Site audit results
 */
async function performSiteAudit(siteUrl, options = {}) {
  console.log(`Starting site audit for ${siteUrl} with options:`, options);
  const startTime = Date.now();
  
  try {
    // Normalize URL
    const normalizedUrl = normalizeUrl(siteUrl);
    
    // Set up audit options with defaults and Railway-friendly settings
    const auditOptions = {
      maxPages: Math.min(options.maxPages || 5, 10),    // Limit to 10 pages max
      maxDepth: Math.min(options.maxDepth || 2, 3),     // Limit to depth 3 max
      concurrency: 1,                                    // Set to 1 for Railway
      timeout: 10000,                                    // 10 second timeout
      respectRobots: options.respectRobots !== false,    // Default to respecting robots.txt
      skipCrawl: options.skipCrawl || false,             // Don't skip crawl by default
      customPages: options.customPages || [],            // No custom pages by default
      cacheResults: options.cacheResults !== false       // Cache results by default
    };
    
    // Check if low memory mode is needed (use for Railway)
    const isLowMemoryMode = true; // Always use low memory mode for Railway
    
    // If in low memory mode, limit pages further
    if (isLowMemoryMode) {
      auditOptions.maxPages = Math.min(auditOptions.maxPages, 5);
      auditOptions.maxDepth = Math.min(auditOptions.maxDepth, 2);
      auditOptions.concurrency = 1;
      
      console.log(`Using low memory mode with reduced limits: maxPages=${auditOptions.maxPages}, maxDepth=${auditOptions.maxDepth}`);
    }
    
    // If custom pages provided and skipCrawl is true, analyze only those pages
    if (auditOptions.skipCrawl && auditOptions.customPages.length > 0) {
      console.log(`Skipping crawl and using ${auditOptions.customPages.length} custom pages`);
      
      // Normalize custom page URLs
      const normalizedCustomPages = auditOptions.customPages.map(url => normalizeUrl(url));
      
      // Create minimal crawl results
      const crawlResults = {
        startUrl: normalizedUrl,
        baseDomain: new URL(normalizedUrl).hostname,
        crawlDuration: 0,
        pagesDiscovered: normalizedCustomPages.length,
        pagesCrawled: normalizedCustomPages.length,
        pagesFailed: 0,
        pagesSkipped: 0,
        customPages: true,
        timestamp: new Date().toISOString()
      };
      
      // Analyze each custom page
      console.log(`Analyzing ${normalizedCustomPages.length} custom pages`);
      const pageAnalysisResults = [];
      
      for (const pageUrl of normalizedCustomPages) {
        try {
          // Analyze the page with timeout
          const analysisPromise = analyzeSeoFunction(pageUrl);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Analysis timeout')), 15000)
          );
          
          // Race the analysis against a timeout
          const analysis = await Promise.race([analysisPromise, timeoutPromise]);
          
          // Add to page results
          pageAnalysisResults.push(analysis);
        } catch (error) {
          console.error(`Error analyzing custom page ${pageUrl}:`, error);
          
          // Add error result
          pageAnalysisResults.push({
            url: pageUrl,
            score: 0,
            status: 'error',
            error: {
              message: `Analysis failed: ${error.message}`
            },
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Calculate overall score (average of successful page scores)
      const successfulPages = pageAnalysisResults.filter(p => p.status !== 'error');
      const overallScore = successfulPages.length > 0
        ? Math.round(successfulPages.reduce((sum, page) => sum + page.score, 0) / successfulPages.length)
        : 0;
      
      // Return site audit results
      return {
        url: normalizedUrl,
        crawlStats: crawlResults,
        pages: pageAnalysisResults,
        analysisStats: {
          pagesAnalyzed: pageAnalysisResults.length,
          pagesSucceeded: successfulPages.length,
          pagesFailed: pageAnalysisResults.length - successfulPages.length
        },
        overallScore,
        overallStatus: overallScore >= 80 ? 'good' : overallScore >= 50 ? 'needs_improvement' : 'poor',
        auditDuration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
    
    // In all other cases, crawl the site and analyze found pages
    const maxPagesToAnalyze = auditOptions.maxPages;
    
    // Create and initialize the crawler
    console.log(`Initializing crawler for ${normalizedUrl} with maxPages=${auditOptions.maxPages}, maxDepth=${auditOptions.maxDepth}`);
    const crawler = new SiteCrawler({
      maxPages: auditOptions.maxPages,
      maxDepth: auditOptions.maxDepth,
      concurrency: auditOptions.concurrency,
      timeout: auditOptions.timeout,
      respectRobots: auditOptions.respectRobots
    });
    
    await crawler.initialize(normalizedUrl);
    
    // Run the crawl
    console.log(`Starting crawl...`);
    const crawlResults = await crawler.crawl();
    
    // Extract page URLs to analyze
    console.log(`Crawl completed. Found ${crawlResults.crawledPages?.length || 0} pages`);
    
    // Ensure we have crawled pages
    if (!crawlResults.crawledPages || crawlResults.crawledPages.length === 0) {
      throw new Error('No pages were successfully crawled');
    }
    
    // Sort pages by depth (analyze shallower pages first)
    const sortedPages = [...crawlResults.crawledPages].sort((a, b) => a.depth - b.depth);
    
    // Limit the number of pages to analyze
    const pagesToAnalyze = sortedPages.slice(0, maxPagesToAnalyze).map(page => page.url);
    
    // Ensure the start URL is included if not already
    if (!pagesToAnalyze.includes(normalizedUrl)) {
      pagesToAnalyze.unshift(normalizedUrl);
    }
    
    console.log(`Analyzing ${pagesToAnalyze.length} pages`);
    
    // Analyze each page sequentially to avoid memory issues
    const pageAnalysisResults = [];
    
    for (const pageUrl of pagesToAnalyze) {
      try {
        console.log(`Analyzing page: ${pageUrl}`);
        
        // Analyze the page with timeout
        const analysisPromise = analyzeSeoFunction(pageUrl);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Analysis timeout')), 15000)
        );
        
        // Race the analysis against a timeout
        const analysis = await Promise.race([analysisPromise, timeoutPromise]);
        
        // Add to page results
        pageAnalysisResults.push(analysis);
      } catch (error) {
        console.error(`Error analyzing page ${pageUrl}:`, error);
        
        // Add error result
        pageAnalysisResults.push({
          url: pageUrl,
          score: 0,
          status: 'error',
          error: {
            message: `Analysis failed: ${error.message}`
          },
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Calculate overall score (average of successful page scores)
    const successfulPages = pageAnalysisResults.filter(p => p.status !== 'error');
    const overallScore = successfulPages.length > 0
      ? Math.round(successfulPages.reduce((sum, page) => sum + page.score, 0) / successfulPages.length)
      : 0;
    
    // Return site audit results
    return {
      url: normalizedUrl,
      crawlStats: crawlResults,
      pages: pageAnalysisResults,
      analysisStats: {
        pagesAnalyzed: pageAnalysisResults.length,
        pagesSucceeded: successfulPages.length,
        pagesFailed: pageAnalysisResults.length - successfulPages.length
      },
      overallScore,
      overallStatus: overallScore >= 80 ? 'good' : overallScore >= 50 ? 'needs_improvement' : 'poor',
      auditDuration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Site audit failed:', error);
    
    // Fall back to homepage-only analysis if crawling fails
    try {
      console.log(`Crawl failed, falling back to homepage-only analysis`);
      const normalizedUrl = normalizeUrl(siteUrl);
      
      // Analyze just the homepage
      console.log(`Analyzing homepage only: ${normalizedUrl}`);
      
      // Analyze the homepage with timeout
      const analysisPromise = analyzeSeoFunction(normalizedUrl);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timeout')), 15000)
      );
      
      // Race the analysis against a timeout
      const analysis = await Promise.race([analysisPromise, timeoutPromise]);
      
      // Create a simplified site audit result
      return {
        url: normalizedUrl,
        crawlStats: {
          startUrl: normalizedUrl,
          baseDomain: new URL(normalizedUrl).hostname,
          pagesDiscovered: 1,
          pagesCrawled: 1,
          pagesFailed: 0,
          pagesSkipped: 0,
          homepageOnly: true,
          fallbackMode: true,
          timestamp: new Date().toISOString()
        },
        pages: [analysis],
        analysisStats: {
          pagesAnalyzed: 1,
          pagesSucceeded: 1,
          pagesFailed: 0
        },
        overallScore: analysis.score,
        overallStatus: analysis.status,
        timestamp: new Date().toISOString()
      };
    } catch (fallbackError) {
      console.error('Fallback analysis also failed:', fallbackError);
      
      return {
        url: siteUrl,
        error: {
          message: `Site audit failed: ${error.message}`,
          fallbackError: fallbackError.message
        },
        status: 'error',
        timestamp: new Date().toISOString()
      };
    }
  }
}
    
    // Try to get from cache first
    let cachedResults = null;
    if (auditOptions.cacheResults && redis.isRedisConfigured) {
      try {
        const cacheKey = generateSiteAuditCacheKey(normalizedUrl, auditOptions);
        console.log(`Checking cache for site audit: ${cacheKey}`);
        
        cachedResults = await redis.getCache(cacheKey);
        
        if (cachedResults) {
          console.log(`Cache hit for site audit: ${normalizedUrl}`);
          return {
            ...cachedResults,
            cached: true,
            cachedAt: cachedResults.timestamp || new Date().toISOString()
          };
        }
        
        console.log(`Cache miss for site audit: ${normalizedUrl}`);
      } catch (error) {
        console.error('Error checking cache:', error);
      }
    }
    
    // Crawl the site if not skipping crawl
    let crawlResults;
    let pagesToAnalyze = [];
    
    if (!auditOptions.skipCrawl) {
      // Initialize and run the crawler
      const crawler = new SiteCrawler({
        maxPages: auditOptions.maxPages,
        maxDepth: auditOptions.maxDepth,
        concurrency: auditOptions.concurrency,
        timeout: auditOptions.timeout,
        respectRobots: auditOptions.respectRobots
      });
      
      await crawler.initialize(normalizedUrl);
      crawlResults = await crawler.crawl();
      
      // Extract crawled pages
      pagesToAnalyze = crawlResults.crawledPages.map(page => page.url);
      
      // Add base URL if it wasn't included (sometimes happens if redirected)
      if (!pagesToAnalyze.includes(normalizedUrl)) {
        pagesToAnalyze.unshift(normalizedUrl);
      }
    } else if (auditOptions.customPages && auditOptions.customPages.length > 0) {
      // Use custom pages list if provided and skipping crawl
      pagesToAnalyze = auditOptions.customPages.map(url => normalizeUrl(url));
      
      // Create minimal crawl results
      crawlResults = {
        startUrl: normalizedUrl,
        baseDomain: new URL(normalizedUrl).hostname,
        crawlDuration: 0,
        pagesDiscovered: pagesToAnalyze.length,
        pagesCrawled: pagesToAnalyze.length,
        pagesFailed: 0,
        pagesSkipped: 0,
        manualList: true,
        timestamp: new Date().toISOString()
      };
    } else {
      // If skipping crawl but no custom pages, just analyze the homepage
      pagesToAnalyze = [normalizedUrl];
      
      // Create minimal crawl results
      crawlResults = {
        startUrl: normalizedUrl,
        baseDomain: new URL(normalizedUrl).hostname,
        crawlDuration: 0,
        pagesDiscovered: 1,
        pagesCrawled: 1,
        pagesFailed: 0,
        pagesSkipped: 0,
        homepageOnly: true,
        timestamp: new Date().toISOString()
      };
    }
    
    console.log(`Found ${pagesToAnalyze.length} pages to analyze`);
    
    // Process pages in batches to avoid overwhelming the server
    const batchSize = 1; // Lower to 1 for Railway deployment to reduce CPU usage
    const pageAnalysisResults = [];
    const processedUrls = new Set();
    
    // Add CPU usage safeguard
    const maxAnalysisTime = 60000; // Maximum 60 seconds total analysis time
    const analysisStartTime = Date.now();
    const checkCpuUsage = () => {
      return (Date.now() - analysisStartTime > maxAnalysisTime);
    };
    
    // Track page analysis performance
    const pageAnalysisStats = {
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0,
      averageTime: 0,
      successCount: 0,
      errorCount: 0
    };
    
    console.log(`Starting analysis of ${pagesToAnalyze.length} pages in batches of ${batchSize}`);
    
    for (let i = 0; i < pagesToAnalyze.length; i += batchSize) {
      // Stop processing if taking too long to avoid Railway CPU limit
      if (checkCpuUsage()) {
        console.log(`Stopping analysis early after ${Math.floor(i/batchSize)} batches to prevent CPU overload`);
        break;
      }
      
      const batch = pagesToAnalyze.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(pagesToAnalyze.length/batchSize)}: ${batch.join(', ')}`);
      
      // Process batch sequentially instead of in parallel for better reliability
      const batchStartTime = Date.now();
      const batchResults = [];
      
      for (const pageUrl of batch) {
        if (processedUrls.has(pageUrl)) {
          console.log(`Skipping duplicate URL: ${pageUrl}`);
          continue;
        }
        
        processedUrls.add(pageUrl);
        
        // Add retry logic for more reliable analysis
        let attempts = 0;
        const maxAttempts = 3;
        let lastError = null;
        let analyzed = false;
        
        while (attempts < maxAttempts && !analyzed) {
          attempts++;
          try {
            console.log(`Analyzing page: ${pageUrl} (attempt ${attempts}/${maxAttempts})`);
            const pageStartTime = Date.now();
            
            // Make sure analyzeSeoFunction is defined and callable
            if (typeof analyzeSeoFunction !== 'function') {
              throw new Error('SEO analysis function is not properly defined');
            }
            
            // Add timeout to prevent analysis from hanging
            const analysisPromise = analyzeSeoFunction(pageUrl);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Analysis timeout')), 20000)
            );
            
            // Race the analysis against a timeout
            const analysis = await Promise.race([analysisPromise, timeoutPromise]);
            
            const pageEndTime = Date.now();
            const analysisTime = pageEndTime - pageStartTime;
            
            // Update statistics
            pageAnalysisStats.totalTime += analysisTime;
            pageAnalysisStats.minTime = Math.min(pageAnalysisStats.minTime, analysisTime);
            pageAnalysisStats.maxTime = Math.max(pageAnalysisStats.maxTime, analysisTime);
            pageAnalysisStats.successCount++;
            
            console.log(`Successfully analyzed ${pageUrl} in ${analysisTime}ms`);
            
            // Add missing properties if not present in result
            const result = {
              ...analysis,
              url: pageUrl, // Ensure URL is set correctly
              timestamp: analysis.timestamp || new Date().toISOString(),
              analyzedAt: analysis.analyzedAt || new Date().toISOString(),
              analysisTime
            };
            
            // Add to batch results
            batchResults.push(result);
            analyzed = true;
          } catch (error) {
            lastError = error;
            console.error(`Error analyzing ${pageUrl} (attempt ${attempts}/${maxAttempts}):`, error);
            
            // Backoff before retry
            if (attempts < maxAttempts) {
              const backoffTime = 2000 * attempts; // Exponential backoff
              console.log(`Waiting ${backoffTime}ms before retrying...`);
              await new Promise(resolve => setTimeout(resolve, backoffTime));
            }
          }
        }
        
        // If all attempts failed, add error result
        if (!analyzed) {
          pageAnalysisStats.errorCount++;
          const errorResult = {
            url: pageUrl,
            score: 0,
            status: 'error',
            error: {
              message: lastError ? `Analysis failed after ${maxAttempts} attempts: ${lastError.message}` : 'Unknown error'
            },
            timestamp: new Date().toISOString(),
            analyzedAt: new Date().toISOString()
          };
          batchResults.push(errorResult);
        }
      }
      
      // Add batch results to overall results
      pageAnalysisResults.push(...batchResults);
      
      const batchEndTime = Date.now();
      console.log(`Batch processed in ${batchEndTime - batchStartTime}ms`);
    }
    
    // Calculate average analysis time
    if (pageAnalysisStats.successCount > 0) {
      pageAnalysisStats.averageTime = pageAnalysisStats.totalTime / pageAnalysisStats.successCount;
    }
    
    // Clean up infinite min time if no successful analyses
    if (pageAnalysisStats.minTime === Infinity) {
      pageAnalysisStats.minTime = 0;
    }
    
    console.log(`Analysis complete. Success: ${pageAnalysisStats.successCount}, Errors: ${pageAnalysisStats.errorCount}`);
    
    // Format the final results
    const endTime = Date.now();
    const auditDuration = endTime - startTime;
    
    const siteAuditResults = {
      url: normalizedUrl,
      crawlStats: crawlResults,
      pages: pageAnalysisResults,
      analysisStats: {
        pagesAnalyzed: pageAnalysisStats.successCount + pageAnalysisStats.errorCount,
        pagesSucceeded: pageAnalysisStats.successCount,
        pagesFailed: pageAnalysisStats.errorCount,
        analysisTime: {
          total: pageAnalysisStats.totalTime,
          average: pageAnalysisStats.averageTime,
          min: pageAnalysisStats.minTime,
          max: pageAnalysisStats.maxTime
        }
      },
      auditDuration,
      timestamp: new Date().toISOString()
    };
    
    // Calculate overall site score (average of successful page scores)
    const successfulPages = pageAnalysisResults.filter(p => p.status !== 'error');
    if (successfulPages.length > 0) {
      const totalScore = successfulPages.reduce((sum, page) => sum + page.score, 0);
      siteAuditResults.overallScore = Math.round(totalScore / successfulPages.length);
      
      // Determine overall status based on score
      siteAuditResults.overallStatus = 
        siteAuditResults.overallScore >= 80 ? 'good' : 
        siteAuditResults.overallScore >= 50 ? 'needs_improvement' : 
        'poor';
    } else {
      siteAuditResults.overallScore = 0;
      siteAuditResults.overallStatus = 'error';
    }
    
    // Cache the results
    if (auditOptions.cacheResults && redis.isRedisConfigured) {
      try {
        const cacheKey = generateSiteAuditCacheKey(normalizedUrl, auditOptions);
        console.log(`Caching site audit results: ${cacheKey}`);
        
        await redis.setCache(cacheKey, siteAuditResults, 24 * 60 * 60); // Cache for 24 hours
        console.log(`Successfully cached site audit results`);
      } catch (error) {
        console.error('Error caching site audit results:', error);
      }
    }
    
    return siteAuditResults;
  } catch (error) {
    console.error('Site audit failed:', error);
    
    return {
      url: siteUrl,
      error: {
        message: `Site audit failed: ${error.message}`,
        stack: error.stack
      },
      status: 'error',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Exports for the site audit module
 */
module.exports = {
  performSiteAudit,
  normalizeUrl,
  generateSiteAuditCacheKey,
  // Add utils object for consistency with other modules
  utils: {
    normalizeUrl,
    generateSiteAuditCacheKey
  }
};