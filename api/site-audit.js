// Simplified site audit endpoint for Railway deployment
const cheerio = require('cheerio');
const axios = require('axios');
const { URL } = require('url');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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
 * Fetch and extract links from a webpage
 */
async function extractLinksFromPage(url, baseUrl, maxDepth) {
  try {
    console.log(`Fetching links from ${url}`);
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'MardenSEOAuditBot/1.0',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!response.data) {
      return [];
    }

    const $ = cheerio.load(response.data);
    const links = new Set();
    const baseDomain = new URL(baseUrl).hostname;

    // Extract all links
    $('a[href]').each((i, el) => {
      try {
        const href = $(el).attr('href');
        if (!href) return;

        // Resolve relative URLs
        const fullUrl = new URL(href, url).href;
        const linkDomain = new URL(fullUrl).hostname;

        // Only include links from the same domain and HTTP/HTTPS protocols
        if (linkDomain === baseDomain && 
            (fullUrl.startsWith('http://') || fullUrl.startsWith('https://'))) {
          links.add(fullUrl);
        }
      } catch (e) {
        // Skip invalid URLs
      }
    });

    return Array.from(links);
  } catch (error) {
    console.error(`Error extracting links from ${url}:`, error.message);
    return [];
  }
}

/**
 * Perform basic SEO analysis of a URL
 */
async function analyzePage(url) {
  try {
    console.log(`Analyzing page: ${url}`);
    const startTime = Date.now();
    
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'MardenSEOAuditBot/1.0',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!response.data) {
      throw new Error('No content received');
    }

    const $ = cheerio.load(response.data);
    
    // Extract basic page data
    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const canonical = $('link[rel="canonical"]').attr('href') || '';
    
    // Count headings
    const h1Count = $('h1').length;
    const h1Texts = $('h1').map((i, el) => $(el).text().trim()).get();
    const h2Count = $('h2').length;
    const h2Texts = $('h2').slice(0, 5).map((i, el) => $(el).text().trim()).get();
    const h3Count = $('h3').length;
    
    // Count images
    const images = $('img');
    const imgCount = images.length;
    const imgWithoutAlt = images.filter((i, el) => !$(el).attr('alt')).length;
    
    // Count links
    const allLinks = $('a[href]');
    const internalLinks = allLinks.filter((i, el) => {
      try {
        const href = $(el).attr('href');
        if (!href) return false;
        
        // Don't count anchor links or javascript links
        if (href.startsWith('#') || href.startsWith('javascript:')) return false;
        
        // Internal links either start with / or have the same domain
        if (href.startsWith('/')) return true;
        
        const baseDomain = new URL(url).hostname;
        const linkDomain = new URL(href, url).hostname;
        return linkDomain === baseDomain;
      } catch {
        return false;
      }
    });
    const externalLinks = allLinks.length - internalLinks.length;
    
    // Calculate word count (simple approximation)
    const bodyText = $('body').text();
    const wordCount = bodyText.trim().split(/\s+/).length;
    
    // Basic score calculation
    let score = 70; // Start with default score
    let issues = [];
    
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
    if (imgWithoutAlt > 0) {
      score -= Math.min(10, imgWithoutAlt);
      issues.push({
        type: 'images_missing_alt',
        severity: 'warning',
        impact: 'medium',
        recommendation: `Add alt text to ${imgWithoutAlt} images`
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
    
    // Ensure score is in range
    score = Math.max(0, Math.min(100, score));
    
    // Determine status
    let status = 'good';
    if (score < 50) {
      status = 'poor';
    } else if (score < 80) {
      status = 'needs_improvement';
    }
    
    // Create categories
    const categories = {
      metadata: {
        score: title && metaDescription ? 80 : 50,
        issues: issues.filter(i => i.type.includes('title') || i.type.includes('meta_description'))
      },
      content: {
        score: h1Count === 1 && wordCount >= 300 ? 80 : 60,
        issues: issues.filter(i => i.type.includes('h1') || i.type.includes('content'))
      },
      technical: {
        score: 75,
        issues: []
      },
      userExperience: {
        score: 70,
        issues: issues.filter(i => i.type.includes('images'))
      }
    };
    
    // Calculate analysis time
    const endTime = Date.now();
    const analysisTime = endTime - startTime;
    
    return {
      url,
      score,
      status,
      criticalIssuesCount: issues.filter(i => i.severity === 'critical').length,
      totalIssuesCount: issues.length,
      categories,
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
          h2Count,
          h2Texts,
          h3Count
        },
        content: {
          wordCount,
          contentLength: bodyText.length
        },
        links: {
          internalCount: internalLinks.length,
          externalCount: externalLinks,
          totalCount: allLinks.length
        },
        images: {
          total: imgCount,
          withoutAlt: imgWithoutAlt
        },
        technical: {
          hasCanonical: !!canonical,
          canonicalUrl: canonical
        }
      },
      metadata: {
        analysisTime,
        htmlSize: `${Math.round(response.data.length / 1024)} KB`
      },
      analyzedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error analyzing ${url}:`, error.message);
    return {
      url,
      score: 0,
      status: 'error',
      error: {
        message: `Analysis failed: ${error.message}`
      },
      analyzedAt: new Date().toISOString()
    };
  }
}

/**
 * Crawl a website and perform SEO analysis
 */
async function crawlAndAnalyzeSite(startUrl, options = {}) {
  console.log(`Starting site audit for ${startUrl} with options:`, options);
  const startTime = Date.now();
  
  try {
    // Normalize URL
    const normalizedUrl = normalizeUrl(startUrl);
    const baseDomain = new URL(normalizedUrl).hostname;
    
    // Configure limits with defaults
    const maxPages = Math.min(options.maxPages || 5, 10);
    const maxDepth = Math.min(options.maxDepth || 2, 3);
    const respectRobots = options.respectRobots !== false;
    
    console.log(`Using maxPages=${maxPages}, maxDepth=${maxDepth}`);
    
    // Initialize data structures
    const discoveredUrls = new Set([normalizedUrl]);
    const crawledUrls = new Set();
    const pageResults = [];
    let urlsToVisit = [normalizedUrl];
    
    // Process until we reach max pages or run out of URLs
    while (urlsToVisit.length > 0 && crawledUrls.size < maxPages) {
      const url = urlsToVisit.shift();
      
      // Skip if already crawled
      if (crawledUrls.has(url)) {
        continue;
      }
      
      console.log(`Processing ${url} (${crawledUrls.size + 1}/${maxPages})`);
      
      // Analyze the page
      try {
        const analysis = await analyzePage(url);
        pageResults.push(analysis);
        crawledUrls.add(url);
        
        // Only discover links if we haven't reached max pages and max depth
        if (crawledUrls.size < maxPages && pageResults.length < maxDepth) {
          const links = await extractLinksFromPage(url, normalizedUrl, maxDepth);
          
          // Add new links to the discovery queue
          for (const link of links) {
            if (!discoveredUrls.has(link)) {
              discoveredUrls.add(link);
              urlsToVisit.push(link);
            }
          }
          
          // Be nice to the server - small delay between requests
          await delay(1000);
        }
      } catch (error) {
        console.error(`Error processing ${url}:`, error.message);
        // Still mark as crawled to avoid infinite loops
        crawledUrls.add(url);
      }
    }
    
    // Calculate overall stats
    const successfulPages = pageResults.filter(p => p.status !== 'error');
    const overallScore = successfulPages.length > 0
      ? Math.round(successfulPages.reduce((sum, page) => sum + page.score, 0) / successfulPages.length)
      : 0;
    
    // Determine overall status
    let overallStatus = 'unknown';
    if (overallScore >= 80) overallStatus = 'good';
    else if (overallScore >= 50) overallStatus = 'needs_improvement';
    else if (overallScore > 0) overallStatus = 'poor';
    
    // Collect all issues
    const allIssues = [];
    pageResults.forEach(result => {
      if (result.categories) {
        Object.values(result.categories).forEach(category => {
          if (category.issues && Array.isArray(category.issues)) {
            category.issues.forEach(issue => {
              allIssues.push({
                url: result.url,
                ...issue
              });
            });
          }
        });
      }
    });
    
    // Group issues by type
    const issuesByType = {};
    allIssues.forEach(issue => {
      const type = issue.type || 'unknown';
      if (!issuesByType[type]) {
        issuesByType[type] = [];
      }
      issuesByType[type].push(issue);
    });
    
    // Calculate issue frequency
    const commonIssues = Object.entries(issuesByType)
      .map(([type, issues]) => ({
        type,
        frequency: issues.length,
        severity: issues[0]?.severity || 'info',
        impact: issues[0]?.impact || 'medium',
        urls: issues.map(issue => issue.url),
        recommendation: issues[0]?.recommendation || 'Fix this issue to improve SEO'
      }))
      .sort((a, b) => b.frequency - a.frequency);
    
    // Create the final results
    const endTime = Date.now();
    const auditDuration = endTime - startTime;
    
    return {
      startUrl: normalizedUrl,
      baseDomain,
      score: overallScore,
      status: overallStatus,
      crawlStats: {
        pagesDiscovered: discoveredUrls.size,
        pagesCrawled: crawledUrls.size,
        maxDepthReached: maxDepth,
        crawlDuration: auditDuration
      },
      siteAnalysis: {
        averageScore: overallScore,
        commonIssues: commonIssues.slice(0, 10), // Top 10 issues
        pages: pageResults.map(result => ({
          url: result.url,
          score: result.score || 0,
          title: result.pageData?.title?.text || '',
          status: result.status || 'unknown',
          issues: result.totalIssuesCount || 0,
          criticalIssues: result.criticalIssuesCount || 0
        }))
      },
      pageResults,
      stats: {
        analysisTime: auditDuration,
        pageCount: pageResults.length
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Site audit failed:', error);
    return {
      startUrl,
      error: {
        message: `Site audit failed: ${error.message}`
      },
      status: 'error',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  crawlAndAnalyzeSite,
  analyzePage,
  normalizeUrl
};
/**
 * Handle SEO analysis API requests
 * This is the main handler function that the API router calls
 */
async function handleSeoAnalyze(req, res) {
  const startTime = Date.now();
  
  try {
    // Extract URL from request
    let url = '';
    let options = {};
    
    if (req.method === 'POST') {
      url = req.body.url;
      options = req.body.options || {};
    } else if (req.method === 'GET') {
      url = req.query.url;
      options = {
        maxPages: req.query.maxPages ? parseInt(req.query.maxPages, 10) : 1,
        maxDepth: req.query.maxDepth ? parseInt(req.query.maxDepth, 10) : 0
      };
    }
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL parameter is required',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`Handling SEO analysis request for: ${url}`);
    
    // Normalize the URL
    const normalizedUrl = normalizeUrl(url);
    
    // For basic SEO analysis, just analyze the single page
    const pageResult = await analyzePage(normalizedUrl);
    
    // Calculate execution time
    const executionTime = Date.now() - startTime;
    
    // Return the result in expected format
    return res.status(200).json({
      status: 'ok',
      message: 'SEO analysis completed',
      url: normalizedUrl,
      cached: false,
      timestamp: new Date().toISOString(),
      executionTime,
      data: pageResult
    });
    
  } catch (error) {
    console.error('SEO analysis error:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'SEO analysis failed',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Update module exports to include the handler
module.exports = {
  crawlAndAnalyzeSite,
  analyzePage,
  normalizeUrl,
  handleSeoAnalyze
};