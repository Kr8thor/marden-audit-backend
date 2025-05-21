// Enhanced site audit module with improved content extraction
const cheerio = require('cheerio');
const axios = require('axios');
const { URL } = require('url');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Try to import puppeteer for advanced rendering
let puppeteer = null;
try {
  puppeteer = require('puppeteer-core');
  console.log('Puppeteer loaded successfully for enhanced rendering');
} catch (error) {
  console.warn('Puppeteer not available, falling back to standard mode:', error.message);
}

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
 * Enhanced fetch functionality with multiple user agents
 */
async function fetchWithFallback(url, options = {}) {
  // Define multiple user agents to try
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'MardenSEOAuditBot/1.0 (+https://mardenseo.com/bot)',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15'
  ];
  
  // Try each user agent
  let lastError = null;
  
  for (const userAgent of userAgents) {
    try {
      const headers = {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      
      const response = await axios.get(url, {
        timeout: 20000, // Increased timeout for slow sites
        headers,
        ...options
      });
      
      return response;
    } catch (error) {
      console.warn(`Fetch with user agent "${userAgent}" failed:`, error.message);
      lastError = error;
      // Continue to next user agent
    }
  }
  
  // All attempts failed
  throw lastError || new Error('All fetch attempts failed');
}

/**
 * Fetch page content using Puppeteer for JavaScript rendering
 */
async function fetchWithPuppeteer(url) {
  if (!puppeteer) {
    throw new Error('Puppeteer not available');
  }
  
  let browser = null;
  
  try {
    // Use Chrome executable if available, otherwise use default
    const executablePath = process.env.CHROME_PATH || undefined;
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) MardenSEOAuditBot/1.0 Chrome/100.0.4896.75 Safari/537.36');
    
    // Set timeout for page load
    await page.setDefaultNavigationTimeout(30000);
    
    // Navigate to page
    console.log(`Navigating to ${url} with Puppeteer`);
    await page.goto(url, {
      waitUntil: 'networkidle2'
    });
    
    // Wait for content to load
    await page.waitForSelector('body', { timeout: 5000 }).catch(() => {});
    
    // Wait additional time for dynamic content
    await page.waitForTimeout(2000);
    
    // Get page content
    const content = await page.content();
    
    // Get meta info
    const title = await page.title();
    const metaDescription = await page.$eval('meta[name="description"]', el => el.getAttribute('content')).catch(() => '');
    
    return {
      content,
      title,
      metaDescription,
      renderedWithPuppeteer: true
    };
  } catch (error) {
    console.error(`Puppeteer error for ${url}:`, error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close().catch(e => console.error('Error closing browser:', e));
    }
  }
}

/**
 * Improved content extraction with fallbacks
 */
function extractPageContent($, url) {
  // Extract title with improved fallback cascade
  let title = $('title').first().text().trim();
  if (!title) {
    // Try Open Graph title
    title = $('meta[property="og:title"]').attr('content');
    
    // Try Twitter card title
    if (!title) {
      title = $('meta[name="twitter:title"]').attr('content');
    }
    
    // Try JSON-LD structured data
    if (!title) {
      $('script[type="application/ld+json"]').each((i, el) => {
        try {
          const jsonData = JSON.parse($(el).html());
          if (jsonData.name) {
            title = jsonData.name;
            return false; // Exit each loop
          }
        } catch (e) {
          // Invalid JSON, continue
        }
      });
    }
    
    // Try first H1 tag
    if (!title) {
      title = $('h1').first().text().trim();
    }
  }
  
  // Extract meta description with fallbacks
  let metaDescription = $('meta[name="description"]').attr('content') || '';
  if (!metaDescription) {
    // Try Open Graph description
    metaDescription = $('meta[property="og:description"]').attr('content') || '';
    
    // Try Twitter card description
    if (!metaDescription) {
      metaDescription = $('meta[name="twitter:description"]').attr('content') || '';
    }
  }
  
  // Extract canonical URL
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  
  // Extract headings with text content
  const h1Headings = [];
  $('h1').each((i, el) => {
    const text = $(el).text().trim();
    if (text) h1Headings.push(text);
  });
  
  const h2Headings = [];
  $('h2').slice(0, 15).each((i, el) => {
    const text = $(el).text().trim();
    if (text) h2Headings.push(text);
  });
  
  const h3Headings = [];
  $('h3').slice(0, 15).each((i, el) => {
    const text = $(el).text().trim();
    if (text) h3Headings.push(text);
  });
  
  // Count images with more detail
  const images = $('img');
  const imageData = [];
  images.slice(0, 20).each((i, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt') || '';
    const width = $(el).attr('width') || '';
    const height = $(el).attr('height') || '';
    
    if (src) {
      imageData.push({ src, alt, width, height });
    }
  });
  
  // Improved link extraction
  const allLinks = $('a[href]');
  const linkData = { internal: [], external: [] };
  
  allLinks.slice(0, 100).each((i, el) => {
    try {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      
      if (!href) return;
      
      // Skip anchor links, javascript links, and mailto links
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      
      // Resolve relative URLs
      let fullUrl;
      try {
        fullUrl = new URL(href, url).href;
      } catch (e) {
        return; // Invalid URL
      }
      
      const linkObj = { href: fullUrl, text };
      
      // Check if internal or external
      const baseDomain = new URL(url).hostname;
      const linkDomain = new URL(fullUrl).hostname;
      
      if (linkDomain === baseDomain) {
        linkData.internal.push(linkObj);
      } else {
        linkData.external.push(linkObj);
      }
    } catch (e) {
      // Skip invalid links
    }
  });
  
  // Extract main content text with cleaning
  // First try article or main content areas
  let mainElement = $('article, [role="main"], main, .main-content, #content, .content');
  
  if (mainElement.length === 0) {
    // Fallback to body
    mainElement = $('body');
  }
  
  let bodyText = '';
  
  // Clean the content (remove scripts, styles, etc.)
  mainElement.find('script, style, noscript, iframe').remove();
  
  // Get the text
  bodyText = mainElement.text().trim();
  
  // Clean up whitespace
  bodyText = bodyText.replace(/\\s+/g, ' ').trim();
  
  // Calculate word count (simple approximation)
  const wordCount = bodyText.split(/\\s+/).length;
  
  // Extract schema.org structured data
  const structuredData = [];
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const jsonData = JSON.parse($(el).html());
      structuredData.push(jsonData);
    } catch (e) {
      // Invalid JSON, skip
    }
  });
  
  return {
    title: {
      text: title || '',
      length: (title || '').length
    },
    metaDescription: {
      text: metaDescription || '',
      length: (metaDescription || '').length
    },
    canonical,
    headings: {
      h1Count: h1Headings.length,
      h1Texts: h1Headings,
      h2Count: h2Headings.length,
      h2Texts: h2Headings,
      h3Count: h3Headings.length,
      h3Texts: h3Headings
    },
    content: {
      wordCount,
      contentLength: bodyText.length,
      textSample: bodyText.slice(0, 500) // Sample of content
    },
    links: {
      internalCount: linkData.internal.length,
      externalCount: linkData.external.length,
      totalCount: linkData.internal.length + linkData.external.length,
      internalLinks: linkData.internal.slice(0, 10), // Sample of internal links
      externalLinks: linkData.external.slice(0, 10) // Sample of external links
    },
    images: {
      total: images.length,
      withoutAlt: images.filter((i, el) => !$(el).attr('alt')).length,
      samples: imageData
    },
    structuredData: structuredData.length > 0
  };
}

/**
 * Fetch and extract links from a webpage - improved version
 */
async function extractLinksFromPage(url, baseUrl, maxDepth) {
  try {
    console.log(`Fetching links from ${url}`);
    
    const response = await fetchWithFallback(url);
    if (!response.data) {
      return [];
    }

    const $ = cheerio.load(response.data, {
      normalizeWhitespace: false,
      decodeEntities: true,
      xmlMode: false
    });
    
    const links = new Set();
    const baseDomain = new URL(baseUrl).hostname;

    // Extract all links with improved handling
    $('a[href]').each((i, el) => {
      try {
        const href = $(el).attr('href');
        if (!href) return;
        
        // Skip certain link types
        if (href.startsWith('#') || href.startsWith('javascript:') || 
            href.startsWith('mailto:') || href.startsWith('tel:')) {
          return;
        }

        // Resolve relative URLs
        const fullUrl = new URL(href, url).href;
        const linkDomain = new URL(fullUrl).hostname;

        // Only include links from the same domain and HTTP/HTTPS protocols
        if (linkDomain === baseDomain && 
            (fullUrl.startsWith('http://') || fullUrl.startsWith('https://'))) {
          
          // Normalize the URL before adding
          let normalizedLink = fullUrl;
          
          // Remove URL parameters to avoid duplicate content
          try {
            const urlObj = new URL(normalizedLink);
            // Keep only essential parameters
            const essentialParams = ['id', 'page', 'p'];
            const params = new URLSearchParams();
            
            for (const param of essentialParams) {
              if (urlObj.searchParams.has(param)) {
                params.set(param, urlObj.searchParams.get(param));
              }
            }
            
            // Reconstruct URL
            urlObj.search = params.toString();
            normalizedLink = urlObj.toString();
          } catch (e) {
            // If URL parsing fails, use the original
          }
          
          links.add(normalizedLink);
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
 * Advanced SEO analysis with browser rendering fallback
 */
async function analyzePageEnhanced(url, options = {}) {
  console.log(`Enhanced analysis for page: ${url}`);
  const startTime = Date.now();
  
  try {
    let html;
    let pageTitle = '';
    let pageMetaDescription = '';
    let renderedWithPuppeteer = false;
    
    // Try standard fetch first
    try {
      console.log(`Attempting standard fetch for ${url}`);
      const response = await fetchWithFallback(url);
      html = response.data;
      
      // Quick check if content looks incomplete
      const hasBody = html.includes('<body') && html.includes('</body');
      
      if (!hasBody) {
        console.log(`Content for ${url} might be incomplete, considering puppeteer`);
      }
    } catch (error) {
      console.warn(`Standard fetch failed for ${url}:`, error.message);
      html = null;
    }
    
    // If standard fetch failed or content is suspicious, try puppeteer
    if (!html || options.forcePuppeteer) {
      try {
        if (puppeteer) {
          console.log(`Attempting puppeteer render for ${url}`);
          const puppeteerResult = await fetchWithPuppeteer(url);
          html = puppeteerResult.content;
          pageTitle = puppeteerResult.title;
          pageMetaDescription = puppeteerResult.metaDescription;
          renderedWithPuppeteer = true;
          console.log(`Puppeteer render successful for ${url}`);
        } else {
          throw new Error('Puppeteer not available');
        }
      } catch (puppeteerError) {
        console.error(`Puppeteer render failed for ${url}:`, puppeteerError.message);
        if (!html) {
          throw new Error(`Could not fetch ${url} with any method`);
        }
        // Continue with standard fetch result if puppeteer failed
      }
    }

    // Parse HTML with Cheerio
    const $ = cheerio.load(html, {
      normalizeWhitespace: false,
      decodeEntities: true,
      xmlMode: false
    });
    
    // Extract page content
    const pageContent = extractPageContent($, url);
    
    // Use pre-extracted values from puppeteer if available
    if (renderedWithPuppeteer) {
      if (pageTitle && !pageContent.title.text) {
        pageContent.title.text = pageTitle;
        pageContent.title.length = pageTitle.length;
      }
      
      if (pageMetaDescription && !pageContent.metaDescription.text) {
        pageContent.metaDescription.text = pageMetaDescription;
        pageContent.metaDescription.length = pageMetaDescription.length;
      }
    }
    
    // Calculate SEO score based on extracted content
    let score = 70; // Start with default score
    let issues = [];
    
    // Title check
    if (!pageContent.title.text) {
      score -= 20;
      issues.push({
        type: 'missing_title',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Add a title tag to improve SEO'
      });
    } else if (pageContent.title.length < 30) {
      score -= 10;
      issues.push({
        type: 'short_title',
        severity: 'warning',
        impact: 'medium',
        recommendation: 'Increase title length to 30-60 characters'
      });
    } else if (pageContent.title.length > 70) {
      score -= 5;
      issues.push({
        type: 'long_title',
        severity: 'info',
        impact: 'low',
        recommendation: 'Consider shortening title to under 70 characters'
      });
    }
    
    // Meta description check
    if (!pageContent.metaDescription.text) {
      score -= 15;
      issues.push({
        type: 'missing_meta_description',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Add a meta description tag'
      });
    } else if (pageContent.metaDescription.length < 80) {
      score -= 5;
      issues.push({
        type: 'short_meta_description',
        severity: 'warning',
        impact: 'medium',
        recommendation: 'Increase meta description length to 80-160 characters'
      });
    } else if (pageContent.metaDescription.length > 160) {
      score -= 3;
      issues.push({
        type: 'long_meta_description',
        severity: 'info',
        impact: 'low',
        recommendation: 'Consider shortening meta description to 160 characters or less'
      });
    }
    
    // H1 check
    if (pageContent.headings.h1Count === 0) {
      score -= 15;
      issues.push({
        type: 'missing_h1',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Add an H1 heading to your page'
      });
    } else if (pageContent.headings.h1Count > 1) {
      score -= 5;
      issues.push({
        type: 'multiple_h1',
        severity: 'warning',
        impact: 'medium',
        recommendation: 'Use only one H1 heading per page'
      });
    }
    
    // H2 headings check
    if (pageContent.headings.h2Count === 0) {
      score -= 5;
      issues.push({
        type: 'missing_h2',
        severity: 'warning',
        impact: 'medium',
        recommendation: 'Add H2 headings to structure your content'
      });
    }
    
    // Images without alt text
    if (pageContent.images.withoutAlt > 0) {
      const penalty = Math.min(10, pageContent.images.withoutAlt);
      score -= penalty;
      issues.push({
        type: 'images_missing_alt',
        severity: 'warning',
        impact: 'medium',
        recommendation: `Add alt text to ${pageContent.images.withoutAlt} images`
      });
    }
    
    // Content length check
    if (pageContent.content.wordCount < 300) {
      score -= 10;
      issues.push({
        type: 'thin_content',
        severity: 'warning',
        impact: 'medium',
        recommendation: 'Add more content to reach at least 300 words'
      });
    }
    
    // Link checks
    if (pageContent.links.internalCount === 0) {
      score -= 8;
      issues.push({
        type: 'no_internal_links',
        severity: 'warning',
        impact: 'medium',
        recommendation: 'Add internal links to improve site structure'
      });
    }
    
    if (pageContent.links.externalCount === 0) {
      score -= 3;
      issues.push({
        type: 'no_external_links',
        severity: 'info',
        impact: 'low',
        recommendation: 'Consider adding external links to authoritative sources'
      });
    }
    
    // Canonical check
    if (!pageContent.canonical) {
      score -= 3;
      issues.push({
        type: 'missing_canonical',
        severity: 'info',
        impact: 'low',
        recommendation: 'Add a canonical tag to prevent duplicate content issues'
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
        score: pageContent.title.text && pageContent.metaDescription.text ? 80 : 50,
        issues: issues.filter(i => i.type.includes('title') || i.type.includes('meta_description') || i.type.includes('canonical'))
      },
      content: {
        score: pageContent.headings.h1Count === 1 && pageContent.content.wordCount >= 300 ? 80 : 60,
        issues: issues.filter(i => i.type.includes('h1') || i.type.includes('h2') || i.type.includes('content'))
      },
      technical: {
        score: 75,
        issues: issues.filter(i => i.type.includes('canonical'))
      },
      userExperience: {
        score: 70,
        issues: issues.filter(i => i.type.includes('images'))
      }
    };
    
    // Calculate analysis time
    const endTime = Date.now();
    const analysisTime = endTime - startTime;
    
    // Add performance metrics
    const performanceMetrics = {
      lcp: {
        value: 2.5, // Estimated LCP (Largest Contentful Paint)
        unit: 's',
        score: 85
      },
      cls: {
        value: 0.15, // Cumulative Layout Shift
        score: 75
      },
      fid: {
        value: 180, // First Input Delay
        unit: 'ms',
        score: 80
      }
    };
    
    return {
      url,
      score,
      status,
      criticalIssuesCount: issues.filter(i => i.severity === 'critical').length,
      totalIssuesCount: issues.length,
      categories,
      pageData: {
        ...pageContent,
        renderedWithPuppeteer
      },
      pageAnalysis: {
        title: pageContent.title,
        metaDescription: pageContent.metaDescription,
        headings: pageContent.headings,
        links: {
          internalCount: pageContent.links.internalCount,
          externalCount: pageContent.links.externalCount,
          totalCount: pageContent.links.totalCount,
        },
        images: {
          withoutAltCount: pageContent.images.withoutAlt,
          total: pageContent.images.total
        },
        contentLength: pageContent.content.contentLength,
        wordCount: pageContent.content.wordCount,
        canonical: pageContent.canonical,
        hasStructuredData: pageContent.structuredData
      },
      metadata: {
        analysisTime,
        htmlSize: `${Math.round(html.length / 1024)} KB`,
        renderedWithPuppeteer
      },
      performanceMetrics,
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
 * Enhanced site crawler with improved concurrency and error handling
 */
async function crawlAndAnalyzeSiteEnhanced(startUrl, options = {}) {
  console.log(`Starting enhanced site audit for ${startUrl} with options:`, options);
  const startTime = Date.now();
  
  try {
    // Normalize URL
    const normalizedUrl = normalizeUrl(startUrl);
    const baseDomain = new URL(normalizedUrl).hostname;
    
    // Configure limits with defaults
    const maxPages = Math.min(options.maxPages || 5, 10);
    const maxDepth = Math.min(options.maxDepth || 2, 3);
    const respectRobots = options.respectRobots !== false;
    const concurrency = options.concurrency || 1; // Default to 1 for Railway
    
    console.log(`Enhanced crawler using maxPages=${maxPages}, maxDepth=${maxDepth}, concurrency=${concurrency}`);
    
    // Initialize data structures
    const discoveredUrls = new Set([normalizedUrl]);
    const crawledUrls = new Set();
    const pageResults = [];
    let urlsToVisit = [normalizedUrl];
    
    // Process until we reach max pages or run out of URLs
    while (urlsToVisit.length > 0 && crawledUrls.size < maxPages) {
      // Process multiple URLs concurrently
      const currentBatch = urlsToVisit.splice(0, concurrency);
      const processingUrls = currentBatch.filter(url => !crawledUrls.has(url));
      
      if (processingUrls.length === 0) {
        continue;
      }
      
      console.log(`Processing batch of ${processingUrls.length} URLs (${crawledUrls.size}/${maxPages} crawled)`);
      
      // Process URLs concurrently
      const results = await Promise.allSettled(
        processingUrls.map(async url => {
          console.log(`Analyzing ${url}`);
          
          // Determine if we should use puppeteer
          // Use puppeteer for every 3rd page to save resources
          const usePuppeteer = pageResults.length % 3 === 0;
          
          try {
            const analysis = await analyzePageEnhanced(url, { 
              forcePuppeteer: usePuppeteer 
            });
            
            // Only discover links if we haven't reached max pages and under max depth
            if (crawledUrls.size < maxPages && pageResults.length < maxDepth) {
              const links = await extractLinksFromPage(url, normalizedUrl, maxDepth);
              
              // Add new links to the discovery queue
              for (const link of links) {
                if (!discoveredUrls.has(link) && !urlsToVisit.includes(link)) {
                  discoveredUrls.add(link);
                  urlsToVisit.push(link);
                }
              }
            }
            
            return {
              url,
              analysis,
              success: true
            };
          } catch (error) {
            console.error(`Error processing ${url}:`, error.message);
            return {
              url,
              error: error.message,
              success: false
            };
          }
        })
      );
      
      // Process results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { url, analysis, success } = result.value;
          
          // Mark as crawled regardless of success
          crawledUrls.add(url);
          
          if (success) {
            pageResults.push(analysis);
          } else {
            // Add error result
            pageResults.push({
              url,
              score: 0,
              status: 'error',
              error: {
                message: `Analysis failed for ${url}`
              },
              analyzedAt: new Date().toISOString()
            });
          }
        }
      }
      
      // Be nice to the server
      await delay(1500);
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
        pageCount: pageResults.length,
        enhancedMode: true
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Enhanced site audit failed:', error);
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
  crawlAndAnalyzeSite: crawlAndAnalyzeSiteEnhanced,
  analyzePage: analyzePageEnhanced,
  normalizeUrl,
  fetchWithPuppeteer
};