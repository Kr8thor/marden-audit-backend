// Consolidated /api/index.js with full SEO analysis
import axios from 'axios';
import cheerio from 'cheerio';
import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://smiling-shrimp-21387.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'AVOLAAIjcDFmNzVjNDVjZGM3MGY0NDczODEyMTA0NTAyOGNkMTc5OXAxMA',
});

// Cache TTL in seconds (1 hour default)
const CACHE_TTL = 3600;
// Timeout for fetch operations (8 seconds)
const FETCH_TIMEOUT = 8000;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin, Cache-Control');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Log the request details
  console.log('Request URL:', req.url);
  console.log('Request Method:', req.method);
  
  // Parse the URL to determine the endpoint
  const path = req.url.split('?')[0];
  
  console.log(`Request received for path: ${path}, method: ${req.method}`);
  
  try {
    // Route to appropriate handler based on the path
    if (path === '/api/health') {
      return handleHealth(req, res);
    } else if (path === '/api/basic-audit') {
      return handleAudit(req, res);
    } else {
      // Default handler for root path
      return handleRoot(req, res);
    }
  } catch (error) {
    console.error('Error handling request:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message || 'An unexpected error occurred'
    });
  }
}

// Health endpoint handler
async function handleHealth(req, res) {
  let redisStatus = {
    status: 'disconnected',
    connected: false
  };

  try {
    // Test Redis connection
    await redis.set('health-check-test', 'ok');
    const testValue = await redis.get('health-check-test');
    
    redisStatus = {
      status: testValue === 'ok' ? 'connected' : 'error',
      connected: testValue === 'ok',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Redis connection error:', error);
    redisStatus = {
      status: 'error',
      connected: false,
      error: error.message
    };
  }

  // Return health status
  return res.status(200).json({
    service: 'MardenSEO Audit API',
    status: 'ok',
    redis: redisStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}

// Root endpoint handler
async function handleRoot(req, res) {
  return res.status(200).json({
    name: 'MardenSEO Audit API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      basicAudit: '/api/basic-audit'
    },
    documentation: 'Use GET or POST to /api/basic-audit with url parameter to run an SEO audit',
    timestamp: new Date().toISOString()
  });
}

// Audit endpoint handler
async function handleAudit(req, res) {
  // Start timing the request for performance metrics
  const startTime = Date.now();
  
  try {
    // Extract URL based on request method
    let targetUrl = null;
    
    if (req.method === 'GET') {
      // For GET requests, extract URL from query parameters
      const urlParts = req.url.split('?');
      if (urlParts.length > 1) {
        const queryParams = new URLSearchParams(urlParts[1]);
        targetUrl = queryParams.get('url');
      }
      console.log('GET audit request with URL:', targetUrl);
    } else if (req.method === 'POST') {
      // For POST requests, extract URL from request body
      if (req.body && typeof req.body === 'object') {
        targetUrl = req.body.url;
      } else if (req.body && typeof req.body === 'string') {
        try {
          const parsed = JSON.parse(req.body);
          targetUrl = parsed.url;
        } catch (e) {
          console.error('Failed to parse JSON body:', e);
        }
      }
      console.log('POST audit request with URL:', targetUrl);
    } else {
      // Return error for other methods
      return res.status(405).json({
        error: 'Method not allowed',
        message: 'This endpoint only accepts GET and POST requests'
      });
    }
    
    // Validate URL parameter
    if (!targetUrl) {
      return res.status(400).json({
        error: 'Missing URL parameter',
        message: 'URL is required',
        method: req.method
      });
    }
    
    // Normalize URL for consistent caching
    const normalizedUrl = normalizeUrl(targetUrl);
    
    // Check cache first
    const cacheKey = `seo-audit:${normalizedUrl}`;
    const cachedResult = await checkCache(cacheKey);
    
    if (cachedResult) {
      console.log(`✅ Cache hit for ${normalizedUrl}`);
      
      // Add execution time and cached flag to the response
      const executionTime = Date.now() - startTime;
      
      return res.status(200).json({
        ...cachedResult,
        cached: true,
        executionTime: `${executionTime}ms`
      });
    }
    
    console.log(`❓ Cache miss for ${normalizedUrl}, performing live audit...`);
    
    // Perform the actual SEO audit
    const auditResult = await performSeoAudit(normalizedUrl, startTime);
    
    // Cache the result
    await cacheResult(cacheKey, auditResult);
    console.log(`✅ Cached results for ${normalizedUrl}`);
    
    // Set explicit content type and return result
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(200).json({
      ...auditResult,
      cached: false
    });
  } catch (error) {
    console.error('Error performing SEO audit:', error);
    
    // Return appropriate error response
    return res.status(500).json({ 
      error: 'SEO audit failed',
      message: error.message || 'An unexpected error occurred during analysis',
      timestamp: new Date().toISOString()
    });
  }
}

// Cache helper functions
async function checkCache(cacheKey) {
  try {
    const cachedData = await redis.get(cacheKey);
    return cachedData;
  } catch (error) {
    console.error('Cache retrieval error:', error);
    return null; // Proceed with live analysis on cache error
  }
}

async function cacheResult(cacheKey, data, ttl = CACHE_TTL) {
  try {
    await redis.set(cacheKey, data, { ex: ttl });
    return true;
  } catch (error) {
    console.error('Cache storage error:', error);
    return false;
  }
}

// Normalize URL to ensure consistent caching
function normalizeUrl(url) {
  let normalized = url.trim().toLowerCase();
  
  // Add protocol if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  
  return normalized;
}

// Main SEO audit function
async function performSeoAudit(url, startTime) {
  try {
    console.log(`Starting SEO audit for ${url}`);
    
    // Fetch the webpage with appropriate timeouts
    let html;
    let fetchStartTime = Date.now();
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'MardenSEOAuditBot/1.0 (+https://audit.mardenseo.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: FETCH_TIMEOUT,
        maxContentLength: 5 * 1024 * 1024, // 5MB max to prevent huge pages
      });
      
      html = response.data;
      console.log(`Fetched HTML in ${Date.now() - fetchStartTime}ms (size: ${html.length} bytes)`);
    } catch (error) {
      // Handle fetch errors with specific messages
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Request timeout for ${url} - site may be slow or unavailable`);
      } else if (error.response) {
        throw new Error(`HTTP error ${error.response.status} when fetching ${url}`);
      } else {
        throw new Error(`Failed to fetch ${url}: ${error.message}`);
      }
    }
    
    // Load HTML into cheerio
    const $ = cheerio.load(html);
    
    console.log(`Starting analysis modules for ${url}`);
    
    // Run parallel analysis where possible to optimize performance
    const [
      metaAnalysis,
      headingsAnalysis, 
      contentAnalysis,
      imageAnalysis,
      linkAnalysis,
      mobileAnalysis,
      performanceAnalysis,
      socialAnalysis,
      technicalAnalysis
    ] = await Promise.all([
      analyzeMeta($, url),
      analyzeHeadings($),
      analyzeContent($),
      analyzeImages($),
      analyzeLinks($, url),
      analyzeMobile($),
      analyzePerformance(html, $),
      analyzeSocialTags($),
      analyzeTechnical(url)
    ]);
    
    console.log(`Completed all analysis modules for ${url}`);
    
    // Compile the overall score
    const overallScore = calculateOverallScore({
      metaAnalysis,
      headingsAnalysis,
      contentAnalysis,
      imageAnalysis,
      linkAnalysis,
      mobileAnalysis,
      performanceAnalysis,
      socialAnalysis,
      technicalAnalysis
    });
    
    // Generate summary
    const summary = generateSummary({
      metaAnalysis,
      headingsAnalysis,
      contentAnalysis,
      imageAnalysis,
      linkAnalysis,
      mobileAnalysis,
      performanceAnalysis,
      socialAnalysis,
      technicalAnalysis
    });
    
    // Calculate execution time
    const executionTime = Date.now() - startTime;
    console.log(`Completed SEO audit for ${url} in ${executionTime}ms`);
    
    // Assemble full response
    return {
      url,
      auditDate: new Date().toISOString(),
      overallScore,
      executionTime: `${executionTime}ms`,
      metrics: {
        meta: metaAnalysis,
        headings: headingsAnalysis,
        content: contentAnalysis,
        images: imageAnalysis,
        links: linkAnalysis,
        mobile: mobileAnalysis,
        performance: performanceAnalysis,
        social: socialAnalysis,
        technical: technicalAnalysis
      },
      summary
    };
  } catch (error) {
    console.error(`Error in SEO audit for ${url}:`, error);
    throw error; // Re-throw to be handled by the main handler
  }
}

// META TAGS ANALYSIS
async function analyzeMeta($, url) {
  try {
    // Extract meta elements
    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
    const canonicalUrl = $('link[rel="canonical"]').attr('href') || '';
    const robotsMeta = $('meta[name="robots"]').attr('content') || '';
    
    // Analysis results
    let score = 100;
    let issues = [];
    
    // Title analysis
    const titleLength = title.length;
    if (titleLength === 0) {
      score -= 20;
      issues.push('Missing title tag');
    } else if (titleLength < 30) {
      score -= 10;
      issues.push('Title is too short (under 30 characters)');
    } else if (titleLength > 60) {
      score -= 5;
      issues.push('Title is too long (over 60 characters)');
    }
    
    // Meta description analysis
    const descriptionLength = metaDescription.length;
    if (descriptionLength === 0) {
      score -= 15;
      issues.push('Missing meta description');
    } else if (descriptionLength < 70) {
      score -= 5;
      issues.push('Meta description is too short (under 70 characters)');
    } else if (descriptionLength > 160) {
      score -= 5;
      issues.push('Meta description is too long (over 160 characters)');
    }
    
    // Canonical URL check
    if (!canonicalUrl) {
      score -= 5;
      issues.push('Missing canonical URL');
    }
    
    // Check for duplicate title/description with meta OpenGraph tags
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogDescription = $('meta[property="og:description"]').attr('content') || '';
    
    if (ogTitle && title && ogTitle !== title) {
      score -= 5;
      issues.push('Title and og:title are different');
    }
    
    if (ogDescription && metaDescription && ogDescription !== metaDescription) {
      score -= 5;
      issues.push('Meta description and og:description are different');
    }
    
    return {
      title: {
        value: title,
        length: titleLength,
      },
      metaDescription: {
        value: metaDescription,
        length: descriptionLength,
      },
      metaKeywords,
      canonicalUrl,
      robotsMeta,
      score: Math.max(0, score),
      issues
    };
  } catch (error) {
    console.error('Error in meta analysis:', error);
    return {
      score: 0,
      issues: ['Error analyzing meta tags']
    };
  }
}

// HEADINGS ANALYSIS
async function analyzeHeadings($) {
  try {
    // Extract headings
    const h1Elements = $('h1');
    const h2Elements = $('h2');
    const h3Elements = $('h3');
    const h4Elements = $('h4');
    const h5Elements = $('h5');
    const h6Elements = $('h6');
    
    const h1Count = h1Elements.length;
    const h2Count = h2Elements.length;
    const h3Count = h3Elements.length;
    const h4Count = h4Elements.length;
    const h5Count = h5Elements.length;
    const h6Count = h6Elements.length;
    
    // Collect heading text for content analysis
    const headings = [];
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      const tag = el.name;
      const text = $(el).text().trim();
      headings.push({ tag, text });
    });
    
    // Analysis
    let score = 100;
    let issues = [];
    
    // Check H1 usage
    if (h1Count === 0) {
      score -= 20;
      issues.push('Missing H1 heading');
    } else if (h1Count > 1) {
      score -= 10;
      issues.push(`Multiple H1 headings (${h1Count}) found`);
    }
    
    // Check heading hierarchy
    if (h1Count >= 1 && h2Count === 0 && (h3Count > 0 || h4Count > 0)) {
      score -= 10;
      issues.push('Improper heading structure (H1 to H3/H4 without H2)');
    }
    
    // Check for empty headings
    let emptyHeadingsCount = 0;
    headings.forEach(heading => {
      if (!heading.text) emptyHeadingsCount++;
    });
    
    if (emptyHeadingsCount > 0) {
      score -= 5;
      issues.push(`${emptyHeadingsCount} empty heading(s) found`);
    }
    
    // Check heading length
    let longHeadingsCount = 0;
    headings.forEach(heading => {
      if (heading.text.length > 70) longHeadingsCount++;
    });
    
    if (longHeadingsCount > 0) {
      score -= 5;
      issues.push(`${longHeadingsCount} heading(s) exceed 70 characters`);
    }
    
    return {
      counts: {
        h1: h1Count,
        h2: h2Count,
        h3: h3Count,
        h4: h4Count,
        h5: h5Count,
        h6: h6Count,
        total: h1Count + h2Count + h3Count + h4Count + h5Count + h6Count
      },
      headings: headings.slice(0, 20), // Limit to first 20 headings
      score: Math.max(0, score),
      issues
    };
  } catch (error) {
    console.error('Error in headings analysis:', error);
    return {
      score: 0,
      issues: ['Error analyzing headings']
    };
  }
}

// CONTENT ANALYSIS
async function analyzeContent($) {
  try {
    // Clone the cheerio object to avoid modifying the original
    const $content = cheerio.load($.html());
    
    // Remove scripts, styles, and other non-content elements for text analysis
    $content('script, style, noscript, iframe, object, embed').remove();
    
    // Get all text from the body
    const bodyText = $content('body').text().trim();
    
    // Word count calculation
    const words = bodyText.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    
    // Paragraph analysis
    const paragraphs = $('p');
    const paragraphCount = paragraphs.length;
    
    // Average paragraph length
    let totalParagraphWords = 0;
    paragraphs.each((i, p) => {
      const text = $(p).text().trim();
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      totalParagraphWords += wordCount;
    });
    const avgParagraphWords = paragraphCount > 0 ? totalParagraphWords / paragraphCount : 0;
    
    // Text-to-HTML ratio
    const htmlSize = $.html().length;
    const textSize = bodyText.length;
    const textToHtmlRatio = htmlSize > 0 ? (textSize / htmlSize) * 100 : 0;
    
    // Analysis
    let score = 100;
    let issues = [];
    
    // Check content length
    if (wordCount < 300) {
      score -= 15;
      issues.push('Low content volume (less than 300 words)');
    }
    
    // Check paragraph structure
    if (paragraphCount < 3 && wordCount > 200) {
      score -= 10;
      issues.push('Few paragraph breaks detected');
    }
    
    // Check average paragraph length
    if (avgParagraphWords > 100) {
      score -= 5;
      issues.push('Paragraphs are too long (average > 100 words)');
    }
    
    // Check text-to-HTML ratio
    if (textToHtmlRatio < 10) {
      score -= 10;
      issues.push('Low text-to-HTML ratio (< 10%)');
    }
    
    // Check for lists, tables, and structured content
    const lists = $('ul, ol').length;
    const tables = $('table').length;
    
    // Keyword density analysis
    // Note: In a full implementation, we could check for provided target keywords
    // For now, we'll just identify the most common words
    const commonWords = getCommonWords(bodyText, 5);
    
    return {
      wordCount,
      paragraphCount,
      avgParagraphWords: Math.round(avgParagraphWords),
      textToHtmlRatio: textToHtmlRatio.toFixed(2) + '%',
      structuredContent: {
        lists,
        tables
      },
      topWords: commonWords,
      score: Math.max(0, score),
      issues
    };
  } catch (error) {
    console.error('Error in content analysis:', error);
    return {
      score: 0,
      issues: ['Error analyzing content']
    };
  }
}

// Helper function to get common words
function getCommonWords(text, count = 5) {
  // Remove common stop words and count frequencies
  const stopWords = new Set(['the', 'and', 'a', 'to', 'of', 'in', 'is', 'it', 'that', 'for', 'on', 'with', 'as', 'by', 'at', 'from', 'be', 'this', 'or', 'an', 'are']);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  const wordFrequency = {};
  words.forEach(word => {
    wordFrequency[word] = (wordFrequency[word] || 0) + 1;
  });
  
  // Sort by frequency
  return Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word, frequency]) => ({
      word,
      frequency,
      percentage: ((frequency / words.length) * 100).toFixed(2) + '%'
    }));
}

// IMAGE ANALYSIS
async function analyzeImages($) {
  try {
    const images = [];
    let totalSize = 0;
    let withAlt = 0;
    let withoutAlt = 0;
    let withTitle = 0;
    
    $('img').each((i, img) => {
      const src = $(img).attr('src') || '';
      const alt = $(img).attr('alt') || '';
      const title = $(img).attr('title') || '';
      const width = $(img).attr('width') || '';
      const height = $(img).attr('height') || '';
      
      // Skip very small images, data URIs, and tracking pixels
      if (src.startsWith('data:') || (width && height && parseInt(width) < 10 && parseInt(height) < 10)) {
        return;
      }
      
      // Count alt text usage
      if (alt.trim()) {
        withAlt++;
      } else {
        withoutAlt++;
      }
      
      // Count title attribute usage
      if (title.trim()) {
        withTitle++;
      }
      
      // Collect image details
      images.push({
        src,
        alt,
        hasAlt: alt.trim().length > 0,
        hasTitle: title.trim().length > 0,
        dimensions: width && height ? `${width}x${height}` : 'unspecified'
      });
    });
    
    // Analyze results
    let score = 100;
    let issues = [];
    
    const totalImages = images.length;
    
    // Check for missing alt text
    if (totalImages > 0) {
      const missingAltPercent = (withoutAlt / totalImages) * 100;
      
      if (missingAltPercent > 0) {
        if (missingAltPercent > 50) {
          score -= 20;
          issues.push(`Majority of images (${missingAltPercent.toFixed(0)}%) missing alt text`);
        } else {
          score -= 10;
          issues.push(`Some images (${withoutAlt}) missing alt text`);
        }
      }
    }
    
    // Check if images have dimensions specified
    const imagesWithoutDimensions = images.filter(img => img.dimensions === 'unspecified').length;
    if (imagesWithoutDimensions > 0 && totalImages > 0) {
      const missingDimensionsPercent = (imagesWithoutDimensions / totalImages) * 100;
      if (missingDimensionsPercent > 50) {
        score -= 10;
        issues.push(`Majority of images missing width/height attributes`);
      } else if (imagesWithoutDimensions > 0) {
        score -= 5;
        issues.push(`${imagesWithoutDimensions} images missing width/height attributes`);
      }
    }
    
    return {
      totalCount: totalImages,
      withAltText: withAlt,
      withoutAltText: withoutAlt,
      withTitleAttr: withTitle,
      images: images.slice(0, 10), // Limit to first 10 images
      score: Math.max(0, score),
      issues
    };
  } catch (error) {
    console.error('Error in image analysis:', error);
    return {
      score: 0,
      issues: ['Error analyzing images']
    };
  }
}

// LINK ANALYSIS
async function analyzeLinks($, baseUrl) {
  try {
    // Parse the base URL
    const baseUrlObj = new URL(baseUrl);
    const domain = baseUrlObj.hostname;
    
    // Initialize counters
    let internalLinks = [];
    let externalLinks = [];
    let brokenLinks = 0;
    let noFollowLinks = 0;
    let emptyLinks = 0;
    
    // Analyze all links
    $('a').each((i, link) => {
      const href = $(link).attr('href') || '';
      const rel = $(link).attr('rel') || '';
      const text = $(link).text().trim();
      
      // Skip empty or javascript links
      if (!href || href === '#' || href.startsWith('javascript:')) {
        emptyLinks++;
        return;
      }
      
      // Check nofollow
      if (rel.includes('nofollow')) {
        noFollowLinks++;
      }
      
      // Determine if internal or external
      try {
        let fullUrl;
        if (href.startsWith('http')) {
          fullUrl = href;
        } else if (href.startsWith('/')) {
          fullUrl = `${baseUrlObj.protocol}//${domain}${href}`;
        } else {
          fullUrl = `${baseUrlObj.protocol}//${domain}/${href}`;
        }
        
        const linkUrlObj = new URL(fullUrl);
        
        const linkData = {
          href,
          text: text || '[No Text]',
          url: fullUrl,
          nofollow: rel.includes('nofollow')
        };
        
        // Internal if same domain
        if (linkUrlObj.hostname === domain) {
          internalLinks.push(linkData);
        } else {
          externalLinks.push(linkData);
        }
      } catch (e) {
        // Likely a malformed URL
        brokenLinks++;
      }
    });
    
    // Analysis
    let score = 100;
    let issues = [];
    
    // Too few internal links
    if (internalLinks.length < 3) {
      score -= 15;
      issues.push('Few internal links (< 3) detected');
    }
    
    // Broken links
    if (brokenLinks > 0) {
      score -= Math.min(20, brokenLinks * 5);
      issues.push(`${brokenLinks} potentially broken or malformed links detected`);
    }
    
    // Empty links
    if (emptyLinks > 0) {
      score -= Math.min(10, emptyLinks * 2);
      issues.push(`${emptyLinks} empty links detected`);
    }
    
    return {
      internalCount: internalLinks.length,
      externalCount: externalLinks.length,
      brokenCount: brokenLinks,
      nofollowCount: noFollowLinks,
      emptyCount: emptyLinks,
      internalLinks: internalLinks.slice(0, 10), // Limit to first 10
      externalLinks: externalLinks.slice(0, 10), // Limit to first 10
      score: Math.max(0, score),
      issues
    };
  } catch (error) {
    console.error('Error in link analysis:', error);
    return {
      score: 0,
      issues: ['Error analyzing links']
    };
  }
}

// MOBILE FRIENDLINESS ANALYSIS
async function analyzeMobile($) {
  try {
    // Check viewport meta tag
    const viewportMeta = $('meta[name="viewport"]').attr('content') || '';
    const hasViewport = viewportMeta.length > 0;
    const hasResponsiveViewport = viewportMeta.includes('width=device-width');
    
    // Check for mobile-specific elements
    const hasMobileMediaQueries = $('style').text().includes('@media') || $('link[rel="stylesheet"]').length > 0;
    
    // Check for touch elements (may not be reliable)
    const touchElements = $('[ontouchstart], [ontouchmove], [ontouchend]').length;
    
    // Check for tap targets (approximation)
    const smallTapTargets = $('a, button').filter(function() {
      const style = $(this).attr('style') || '';
      // This is a rough approximation - in practice, we'd need to render the page
      return (style.includes('width') && style.includes('px') && parseInt(style.match(/width:\s*(\d+)px/)?.[1] || '100') < 40);
    }).length;
    
    // Analysis
    let score = 100;
    let issues = [];
    
    // Viewport issues
    if (!hasViewport) {
      score -= 30;
      issues.push('Missing viewport meta tag');
    } else if (!hasResponsiveViewport) {
      score -= 15;
      issues.push('Viewport meta tag does not include width=device-width');
    }
    
    // Media query check (less reliable)
    if (!hasMobileMediaQueries) {
      score -= 10;
      issues.push('No media queries detected (may not be mobile responsive)');
    }
    
    // Small tap targets
    if (smallTapTargets > 0) {
      score -= Math.min(15, smallTapTargets * 3);
      issues.push(`Approximately ${smallTapTargets} small tap targets detected`);
    }
    
    return {
      hasViewportMeta: hasViewport,
      viewportContent: viewportMeta,
      hasMediaQueries: hasMobileMediaQueries,
      score: Math.max(0, score),
      issues
    };
  } catch (error) {
    console.error('Error in mobile analysis:', error);
    return {
      score: 0,
      issues: ['Error analyzing mobile friendliness']
    };
  }
}

// PERFORMANCE ANALYSIS
async function analyzePerformance(html, $) {
  try {
    // Basic performance metrics
    const htmlSize = html.length;
    const htmlSizeKB = (htmlSize / 1024).toFixed(2);
    
    // Count resources
    const cssFiles = $('link[rel="stylesheet"]').length;
    const jsFiles = $('script[src]').length;
    const inlineStyles = $('style').length;
    const inlineScripts = $('script:not([src])').length;
    const totalResources = cssFiles + jsFiles;
    const totalInlineResources = inlineStyles + inlineScripts;
    
    // Check for render blocking resources
    const renderBlockingCSS = $('link[rel="stylesheet"]:not([media="print"]):not([media="speech"])').length;
    
    // Image optimization check (basic)
    const unoptimizedImages = $('img:not([loading="lazy"])').length;
    
    // Analysis
    let score = 100;
    let issues = [];
    
    // HTML size check
    if (htmlSize > 100000) { // 100KB
      score -= 20;
      issues.push('HTML document is large (> 100KB)');
    } else if (htmlSize > 50000) { // 50KB
      score -= 10;
      issues.push('HTML document is moderately large (> 50KB)');
    }
    
    // Resource count check
    if (totalResources > 30) {
      score -= 15;
      issues.push(`High number of external resources (${totalResources})`);
    }
    
    // Render blocking resources
    if (renderBlockingCSS > 3) {
      score -= 15;
      issues.push(`Multiple render-blocking CSS files (${renderBlockingCSS})`);
    }
    
    // Inline scripts/styles
    if (totalInlineResources > 5) {
      score -= 10;
      issues.push(`High number of inline styles/scripts (${totalInlineResources})`);
    }
    
    // Lazy loading
    if (unoptimizedImages > 3) {
      score -= 10;
      issues.push(`Multiple images without lazy loading (${unoptimizedImages})`);
    }
    
    return {
      htmlSize: htmlSize,
      htmlSizeKB: htmlSizeKB,
      resources: {
        cssFiles,
        jsFiles,
        inlineStyles,
        inlineScripts,
        total: totalResources + totalInlineResources
      },
      renderBlocking: {
        css: renderBlockingCSS,
      },
      nonLazyImages: unoptimizedImages,
      score: Math.max(0, score),
      issues
    };
  } catch (error) {
    console.error('Error in performance analysis:', error);
    return {
      score: 0,
      issues: ['Error analyzing performance']
    };
  }
}

// SOCIAL MEDIA ANALYSIS
async function analyzeSocialTags($) {
  try {
    // Extract Open Graph tags
    const og = {
      title: $('meta[property="og:title"]').attr('content') || '',
      description: $('meta[property="og:description"]').attr('content') || '',
      image: $('meta[property="og:image"]').attr('content') || '',
      url: $('meta[property="og:url"]').attr('content') || '',
      type: $('meta[property="og:type"]').attr('content') || '',
      siteName: $('meta[property="og:site_name"]').attr('content') || ''
    };
    
    // Extract Twitter Card tags
    const twitter = {
      card: $('meta[name="twitter:card"]').attr('content') || '',
      title: $('meta[name="twitter:title"]').attr('content') || '',
      description: $('meta[name="twitter:description"]').attr('content') || '',
      image: $('meta[name="twitter:image"]').attr('content') || '',
      site: $('meta[name="twitter:site"]').attr('content') || '',
      creator: $('meta[name="twitter:creator"]').attr('content') || ''
    };
    
    // Check for schema.org structured data (basic check)
    const hasStructuredData = $('script[type="application/ld+json"]').length > 0;
    
    // Analysis
    let score = 100;
    let issues = [];
    
    // Check Open Graph
    const hasCompleteOG = og.title && og.description && og.image;
    if (!hasCompleteOG) {
      score -= 15;
      if (!og.title && !og.description && !og.image) {
        issues.push('No Open Graph tags found');
      } else {
        const missing = [];
        if (!og.title) missing.push('og:title');
        if (!og.description) missing.push('og:description');
        if (!og.image) missing.push('og:image');
        issues.push(`Incomplete Open Graph tags (missing: ${missing.join(', ')})`);
      }
    }
    
    // Check Twitter Card
    const hasCompleteTwitter = twitter.card && (twitter.title || twitter.description || twitter.image);
    if (!hasCompleteTwitter) {
      score -= 15;
      if (!twitter.card && !twitter.title && !twitter.description && !twitter.image) {
        issues.push('No Twitter Card tags found');
      } else {
        const missing = [];
        if (!twitter.card) missing.push('twitter:card');
        if (!twitter.title && !og.title) missing.push('twitter:title');
        if (!twitter.description && !og.description) missing.push('twitter:description');
        if (!twitter.image && !og.image) missing.push('twitter:image');
        
        if (missing.length > 0) {
          issues.push(`Incomplete Twitter Card tags (missing: ${missing.join(', ')})`);
        }
      }
    }
    
    // Check for structured data
    if (!hasStructuredData) {
      score -= 10;
      issues.push('No schema.org structured data detected');
    }
    
    return {
      openGraph: og,
      twitterCard: twitter,
      hasStructuredData,
      score: Math.max(0, score),
      issues
    };
  } catch (error) {
    console.error('Error in social media analysis:', error);
    return {
      score: 0,
      issues: ['Error analyzing social media tags']
    };
  }
}

// TECHNICAL SEO ANALYSIS
async function analyzeTechnical(url) {
  try {
    // Parse URL
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;
    const protocol = parsedUrl.protocol;
    
    // Check HTTPS
    const isHttps = protocol === 'https:';
    
    // Initialize results
    let results = {
      domain,
      protocol,
      isHttps,
      robotsTxt: { exists: false, content: null },
      sitemapXml: { exists: false, url: null },
      score: 100,
      issues: []
    };
    
    // Check for robots.txt
    try {
      const robotsUrl = `${protocol}//${domain}/robots.txt`;
      const robotsResponse = await axios.get(robotsUrl, { 
        timeout: 3000,
        validateStatus: status => status === 200
      });
      
      if (robotsResponse.status === 200) {
        results.robotsTxt.exists = true;
        results.robotsTxt.content = robotsResponse.data.substring(0, 500) + (robotsResponse.data.length > 500 ? '...' : '');
        
        // Look for sitemap in robots.txt
        const sitemapMatch = robotsResponse.data.match(/Sitemap:\s*(.+)/i);
        if (sitemapMatch && sitemapMatch[1]) {
          results.sitemapXml.exists = true;
          results.sitemapXml.url = sitemapMatch[1].trim();
        } else {
          // Check for default sitemap location
          try {
            const sitemapUrl = `${protocol}//${domain}/sitemap.xml`;
            const sitemapResponse = await axios.get(sitemapUrl, { 
              timeout: 3000,
              validateStatus: status => status === 200
            });
            
            if (sitemapResponse.status === 200) {
              results.sitemapXml.exists = true;
              results.sitemapXml.url = sitemapUrl;
            }
          } catch (error) {
            // Sitemap not found at default location - this is ok
          }
        }
      }
    } catch (error) {
      // Failed to fetch robots.txt, it might not exist - this is ok
    }
    
    // Analysis
    if (!isHttps) {
      results.score -= 20;
      results.issues.push('Site not using HTTPS');
    }
    
    if (!results.robotsTxt.exists) {
      results.score -= 10;
      results.issues.push('No robots.txt file found');
    }
    
    if (!results.sitemapXml.exists) {
      results.score -= 10;
      results.issues.push('No sitemap.xml found');
    }
    
    return {
      ...results,
      score: Math.max(0, results.score)
    };
  } catch (error) {
    console.error('Error in technical analysis:', error);
    return {
      score: 0,
      issues: ['Error analyzing technical SEO aspects']
    };
  }
}

// Calculate overall score
function calculateOverallScore(metrics) {
  // Define weights for each category
  const weights = {
    metaAnalysis: 0.15,
    headingsAnalysis: 0.10,
    contentAnalysis: 0.20,
    imageAnalysis: 0.10,
    linkAnalysis: 0.10,
    mobileAnalysis: 0.10,
    performanceAnalysis: 0.10,
    socialAnalysis: 0.05,
    technicalAnalysis: 0.10
  };
  
  let weightedScore = 0;
  let totalWeight = 0;
  
  // Calculate weighted average
  Object.entries(metrics).forEach(([key, metric]) => {
    const weight = weights[key];
    if (weight && metric && typeof metric.score === 'number') {
      weightedScore += metric.score * weight;
      totalWeight += weight;
    }
  });
  
  // Avoid division by zero
  if (totalWeight === 0) return 0;
  
  // Return rounded score
  return Math.round(weightedScore / totalWeight);
}

// Generate summary of findings
function generateSummary(metrics) {
  // Collect all issues
  const allIssues = [];
  Object.values(metrics).forEach(metric => {
    if (metric && metric.issues && Array.isArray(metric.issues)) {
      allIssues.push(...metric.issues);
    }
  });
  
  // Count issues by severity (assumption: lower scores = more critical issues)
  const criticalIssues = [];
  const majorIssues = [];
  const minorIssues = [];
  
  Object.entries(metrics).forEach(([key, metric]) => {
    if (metric && metric.issues && Array.isArray(metric.issues)) {
      if (metric.score < 50) { // Critical
        criticalIssues.push(...metric.issues.map(issue => ({ category: key.replace('Analysis', ''), issue })));
      } else if (metric.score < 80) { // Major
        majorIssues.push(...metric.issues.map(issue => ({ category: key.replace('Analysis', ''), issue })));
      } else { // Minor
        minorIssues.push(...metric.issues.map(issue => ({ category: key.replace('Analysis', ''), issue })));
      }
    }
  });
  
  // Generate summary text
  let summaryText = '';
  
  if (criticalIssues.length === 0 && majorIssues.length === 0) {
    summaryText = 'The page is well-optimized for search engines with no major issues found.';
  } else {
    summaryText = `Found ${criticalIssues.length} critical, ${majorIssues.length} major, and ${minorIssues.length} minor issues.`;
    
    if (criticalIssues.length > 0) {
      summaryText += ` Critical issues include: ${criticalIssues.slice(0, 3).map(i => i.issue).join('; ')}${criticalIssues.length > 3 ? '...' : '.'}`;
    }
    
    if (majorIssues.length > 0 && criticalIssues.length === 0) {
      summaryText += ` Major issues include: ${majorIssues.slice(0, 3).map(i => i.issue).join('; ')}${majorIssues.length > 3 ? '...' : '.'}`;
    }
  }
  
  return {
    text: summaryText,
    issueCount: {
      critical: criticalIssues.length,
      major: majorIssues.length,
      minor: minorIssues.length,
      total: criticalIssues.length + majorIssues.length + minorIssues.length
    },
    topIssues: [
      ...criticalIssues.slice(0, 3).map(i => ({ severity: 'critical', ...i })),
      ...majorIssues.slice(0, criticalIssues.length > 0 ? 2 : 3).map(i => ({ severity: 'major', ...i }))
    ]
  };
}
