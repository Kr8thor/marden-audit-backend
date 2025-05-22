/**
 * Working Site Crawler - Memory Efficient Implementation
 * This module provides reliable site crawling without Puppeteer
 * Optimized for Railway's 256MB memory constraints
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const redis = require('./lib/redis.optimized');

// Memory cache for quick access
const memoryCache = new Map();
const MEMORY_CACHE_MAX_SIZE = 50; // Reduced for memory efficiency
const MEMORY_CACHE_TTL = 3600000; // 1 hour

/**
 * Normalize URL
 */
function normalizeUrl(url) {
  if (!url) return '';
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

/**
 * Extract internal links from HTML
 */
function extractInternalLinks(html, baseUrl) {
  try {
    const $ = cheerio.load(html, { 
      normalizeWhitespace: false,
      decodeEntities: false 
    });
    
    const baseUrlObj = new URL(baseUrl);
    const links = new Set();
    
    // Extract from anchor tags
    $('a[href]').each((i, el) => {
      if (i > 50) return false; // Limit processing for memory
      
      const href = $(el).attr('href');
      if (!href) return;
      
      try {
        const linkUrl = new URL(href, baseUrl);
        
        // Only same domain links
        if (linkUrl.hostname === baseUrlObj.hostname) {
          // Clean URL (remove fragments, certain params)
          linkUrl.hash = '';
          links.add(linkUrl.href);
        }
      } catch (e) {
        // Skip invalid URLs
      }
    });
    
    return Array.from(links).slice(0, 20); // Memory limit
  } catch (error) {
    console.error('Error extracting links:', error.message);
    return [];
  }
}

/**
 * Analyze a single page efficiently
 */
async function analyzePage(url, timeout = 15000) {
  console.log(`📊 Analyzing: ${url}`);
  
  try {
    // Set up axios with proper config
    const response = await axios.get(url, {
      timeout,
      maxContentLength: 5 * 1024 * 1024, // 5MB limit
      headers: {
        'User-Agent': 'Marden SEO Audit Tool (compatible crawler)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      },
      validateStatus: (status) => status < 400 // Accept redirects
    });
    
    const html = response.data;
    const $ = cheerio.load(html, { 
      normalizeWhitespace: false,
      decodeEntities: false 
    });
    
    // Extract basic SEO data efficiently
    const analysis = {
      url,
      status: 'success',
      statusCode: response.status,
      
      // Page metadata
      title: {
        text: $('title').first().text().trim() || '',
        length: $('title').first().text().trim().length
      },
      
      metaDescription: {
        text: $('meta[name="description"]').attr('content') || '',
        length: ($('meta[name="description"]').attr('content') || '').length
      },
      
      // Headings analysis
      headings: {
        h1Count: $('h1').length,
        h1Texts: $('h1').map((i, el) => $(el).text().trim()).get().slice(0, 5),
        h2Count: $('h2').length,
        h2Texts: $('h2').map((i, el) => $(el).text().trim()).get().slice(0, 3),
        h3Count: $('h3').length
      },
      
      // Content analysis
      content: {
        textLength: $('body').text().length,
        wordCount: $('body').text().split(/\s+/).filter(word => word.length > 0).length,
        paragraphs: $('p').length
      },
      
      // Technical elements
      images: {
        total: $('img').length,
        withoutAlt: $('img:not([alt]), img[alt=""]').length,
        samples: $('img').slice(0, 3).map((i, el) => ({
          src: $(el).attr('src') || '',
          alt: $(el).attr('alt') || ''
        })).get()
      },
      
      // Links analysis
      links: {
        total: $('a[href]').length,
        internal: 0, // Will be calculated
        external: 0  // Will be calculated
      },
      
      // Extract internal links for crawling
      internalLinks: extractInternalLinks(html, url),
      
      analyzedAt: new Date().toISOString(),
      responseTime: Date.now() - Date.now() // Will be set by caller
    };
    
    // Calculate internal vs external links
    const baseHostname = new URL(url).hostname;
    $('a[href]').each((i, el) => {
      if (i > 100) return false; // Memory limit
      
      const href = $(el).attr('href');
      if (!href) return;
      
      try {
        const linkUrl = new URL(href, url);
        if (linkUrl.hostname === baseHostname) {
          analysis.links.internal++;
        } else {
          analysis.links.external++;
        }
      } catch (e) {
        // Skip invalid URLs
      }
    });
    
    return analysis;
  } catch (error) {
    console.error(`❌ Error analyzing ${url}:`, error.message);
    
    return {
      url,
      status: 'error',
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      },
      analyzedAt: new Date().toISOString()
    };
  }
}

/**
 * Crawl a website with memory-efficient approach
 */
async function crawlSite(startUrl, options = {}) {
  const startTime = Date.now();
  console.log(`🕷️ Starting site crawl for: ${startUrl}`);
  
  // Configuration with safe defaults
  const config = {
    maxPages: Math.min(options.maxPages || 5, 10), // Hard limit for memory
    maxDepth: Math.min(options.maxDepth || 2, 3),   // Hard limit for memory
    timeout: options.timeout || 15000
  };
  
  console.log(`📋 Crawl config:`, config);
  
  // Crawl state
  const crawled = new Set();
  const toVisit = [{ url: normalizeUrl(startUrl), depth: 0 }];
  const results = [];
  const errors = [];
  
  try {
    // Process URLs breadth-first
    while (toVisit.length > 0 && results.length < config.maxPages) {
      const { url, depth } = toVisit.shift();
      
      // Skip if already crawled
      if (crawled.has(url)) continue;
      crawled.add(url);
      
      console.log(`🔍 Crawling (depth ${depth}): ${url}`);
      
      // Analyze the page
      const pageStart = Date.now();
      const pageAnalysis = await analyzePage(url, config.timeout);
      pageAnalysis.responseTime = Date.now() - pageStart;
      pageAnalysis.depth = depth;
      
      if (pageAnalysis.status === 'success') {
        results.push(pageAnalysis);
        
        // Add internal links for next depth level
        if (depth < config.maxDepth && pageAnalysis.internalLinks) {
          for (const link of pageAnalysis.internalLinks) {
            if (!crawled.has(link) && !toVisit.some(item => item.url === link)) {
              toVisit.push({ url: link, depth: depth + 1 });
            }
          }
        }
      } else {
        errors.push(pageAnalysis);
      }
      
      // Memory management - force garbage collection periodically
      if (results.length % 3 === 0) {
        if (global.gc) {
          global.gc();
        }
      }
    }
  } catch (error) {
    console.error('❌ Crawl error:', error.message);
    errors.push({
      url: startUrl,
      status: 'error',
      error: { message: error.message }
    });
  }
  
  const crawlTime = Date.now() - startTime;
  
  // Calculate aggregate metrics
  const successfulPages = results.filter(r => r.status === 'success');
  const avgScore = successfulPages.length > 0 
    ? Math.round(successfulPages.reduce((sum, page) => {
        // Simple scoring based on basic SEO factors
        let score = 100;
        if (!page.title.text) score -= 30;
        if (page.title.length > 60) score -= 10;
        if (!page.metaDescription.text) score -= 20;
        if (page.metaDescription.length > 160) score -= 10;
        if (page.headings.h1Count !== 1) score -= 15;
        if (page.images.withoutAlt > 0) score -= 10;
        return sum + Math.max(score, 0);
      }, 0) / successfulPages.length)
    : 0;
  
  const crawlResult = {
    startUrl: normalizeUrl(startUrl),
    crawlConfig: config,
    crawlStats: {
      totalPages: results.length,
      successfulPages: successfulPages.length,
      errors: errors.length,
      crawlTime,
      avgScore,
      maxDepthReached: Math.max(...results.map(r => r.depth || 0), 0)
    },
    pages: results,
    errors: errors.length > 0 ? errors : [],
    summary: {
      commonIssues: findCommonIssues(successfulPages),
      recommendations: generateRecommendations(successfulPages)
    },
    analyzedAt: new Date().toISOString()
  };
  
  console.log(`✅ Crawl completed: ${results.length} pages in ${crawlTime}ms`);
  return crawlResult;
}

/**
 * Find common issues across crawled pages
 */
function findCommonIssues(pages) {
  const issues = [];
  
  if (pages.length === 0) return issues;
  
  // Check for common title issues
  const noTitles = pages.filter(p => !p.title.text).length;
  const longTitles = pages.filter(p => p.title.length > 60).length;
  
  if (noTitles > 0) {
    issues.push({
      type: 'missing_titles',
      count: noTitles,
      severity: 'high',
      description: `${noTitles} pages are missing title tags`
    });
  }
  
  if (longTitles > pages.length / 2) {
    issues.push({
      type: 'long_titles',
      count: longTitles,
      severity: 'medium',
      description: `${longTitles} pages have titles longer than 60 characters`
    });
  }
  
  // Check for meta description issues
  const noDescriptions = pages.filter(p => !p.metaDescription.text).length;
  if (noDescriptions > 0) {
    issues.push({
      type: 'missing_meta_descriptions',
      count: noDescriptions,
      severity: 'high',
      description: `${noDescriptions} pages are missing meta descriptions`
    });
  }
  
  // Check for H1 issues
  const multipleH1s = pages.filter(p => p.headings.h1Count > 1).length;
  const noH1s = pages.filter(p => p.headings.h1Count === 0).length;
  
  if (multipleH1s > 0) {
    issues.push({
      type: 'multiple_h1s',
      count: multipleH1s,
      severity: 'medium',
      description: `${multipleH1s} pages have multiple H1 tags`
    });
  }
  
  if (noH1s > 0) {
    issues.push({
      type: 'missing_h1s',
      count: noH1s,
      severity: 'high',
      description: `${noH1s} pages are missing H1 tags`
    });
  }
  
  // Check for image alt text issues
  const totalImagesWithoutAlt = pages.reduce((sum, p) => sum + (p.images.withoutAlt || 0), 0);
  if (totalImagesWithoutAlt > 0) {
    issues.push({
      type: 'missing_alt_text',
      count: totalImagesWithoutAlt,
      severity: 'medium',
      description: `${totalImagesWithoutAlt} images are missing alt text across the site`
    });
  }
  
  return issues.slice(0, 10); // Limit for memory
}

/**
 * Generate recommendations based on crawl results
 */
function generateRecommendations(pages) {
  const recommendations = [];
  
  if (pages.length === 0) {
    return ['No pages were successfully analyzed. Check if the website is accessible.'];
  }
  
  // Analyze aggregate data
  const avgTitleLength = pages.reduce((sum, p) => sum + p.title.length, 0) / pages.length;
  const avgDescLength = pages.reduce((sum, p) => sum + p.metaDescription.length, 0) / pages.length;
  const pagesWithoutDesc = pages.filter(p => !p.metaDescription.text).length;
  
  if (avgTitleLength > 60) {
    recommendations.push('Consider shortening page titles to under 60 characters for better search results display');
  }
  
  if (avgDescLength < 120) {
    recommendations.push('Meta descriptions could be more detailed (aim for 120-160 characters) to improve click-through rates');
  }
  
  if (pagesWithoutDesc > pages.length / 2) {
    recommendations.push('Add meta descriptions to pages that are missing them - this significantly impacts search result appearance');
  }
  
  const multiH1Pages = pages.filter(p => p.headings.h1Count > 1).length;
  if (multiH1Pages > 0) {
    recommendations.push('Use only one H1 tag per page to maintain proper heading hierarchy');
  }
  
  const avgImagesPerPage = pages.reduce((sum, p) => sum + p.images.total, 0) / pages.length;
  const avgMissingAlt = pages.reduce((sum, p) => sum + (p.images.withoutAlt || 0), 0) / pages.length;
  
  if (avgMissingAlt > 0) {
    recommendations.push('Add descriptive alt text to images for better accessibility and SEO');
  }
  
  if (pages.some(p => p.content.wordCount < 300)) {
    recommendations.push('Consider adding more content to thin pages (aim for at least 300 words)');
  }
  
  return recommendations.slice(0, 8); // Limit for memory
}

/**
 * Main API handler for site crawling
 */
async function handleSiteCrawl(req, res) {
  const startTime = Date.now();
  console.log('🕷️ Site crawl request received');
  
  try {
    // Extract URL and options
    let url = '';
    let options = {};
    
    if (req.method === 'POST') {
      url = req.body.url;
      options = req.body.options || {};
    } else {
      url = req.query.url;
      options = {
        maxPages: parseInt(req.query.maxPages) || 5,
        maxDepth: parseInt(req.query.maxDepth) || 2
      };
    }
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL parameter is required',
        timestamp: new Date().toISOString()
      });
    }
    
    const normalizedUrl = normalizeUrl(url);
    console.log(`🎯 Crawling: ${normalizedUrl}`);
    
    // Check cache first
    const cacheKey = `site-crawl:${normalizedUrl}:${options.maxPages || 5}:${options.maxDepth || 2}`;
    
    // Memory cache check
    if (memoryCache.has(cacheKey)) {
      const cached = memoryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
        console.log('💾 Memory cache hit for site crawl');
        return res.status(200).json({
          status: 'ok',
          message: 'Site crawl results (cached)',
          url: normalizedUrl,
          cached: true,
          cachedAt: new Date(cached.timestamp).toISOString(),
          timestamp: new Date().toISOString(),
          data: cached.data
        });
      } else {
        memoryCache.delete(cacheKey);
      }
    }
    
    // Redis cache check
    if (redis.isRedisConfigured) {
      try {
        const cachedResult = await redis.getCache(cacheKey);
        if (cachedResult) {
          console.log('🔄 Redis cache hit for site crawl');
          
          // Update memory cache
          if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
            const oldestKey = memoryCache.keys().next().value;
            memoryCache.delete(oldestKey);
          }
          memoryCache.set(cacheKey, {
            data: cachedResult.data,
            timestamp: Date.now()
          });
          
          return res.status(200).json({
            status: 'ok',
            message: 'Site crawl results (cached)',
            url: normalizedUrl,
            cached: true,
            cachedAt: cachedResult.timestamp,
            timestamp: new Date().toISOString(),
            data: cachedResult.data
          });
        }
      } catch (cacheError) {
        console.error('Cache error:', cacheError.message);
      }
    }
    
    // Perform the crawl
    console.log('🚀 Starting fresh site crawl...');
    const crawlResult = await crawlSite(normalizedUrl, options);
    
    // Cache the result
    const cacheData = {
      data: crawlResult,
      timestamp: new Date().toISOString()
    };
    
    // Memory cache
    if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
      const oldestKey = memoryCache.keys().next().value;
      memoryCache.delete(oldestKey);
    }
    memoryCache.set(cacheKey, {
      data: crawlResult,
      timestamp: Date.now()
    });
    
    // Redis cache
    if (redis.isRedisConfigured) {
      try {
        await redis.setCache(cacheKey, cacheData, 86400); // 24 hour TTL
      } catch (cacheError) {
        console.error('Redis cache error:', cacheError.message);
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Site crawl completed in ${totalTime}ms`);
    
    return res.status(200).json({
      status: 'ok',
      message: 'Site crawl completed',
      url: normalizedUrl,
      cached: false,
      timestamp: new Date().toISOString(),
      executionTime: totalTime,
      data: crawlResult
    });
    
  } catch (error) {
    console.error('❌ Site crawl error:', error.message);
    
    return res.status(500).json({
      status: 'error',
      message: 'Site crawl failed',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = handleSiteCrawl;
