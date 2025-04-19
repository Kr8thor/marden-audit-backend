// Consolidated API handler for SEO Audit Tool
const axios = require('axios');
const cheerio = require('cheerio');
const { Redis } = require('@upstash/redis');

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://smiling-shrimp-21387.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'AVOLAAIjcDFmNzVjNDVjZGM3MGY0NDczODEyMTA0NTAyOGNkMTc5OXAxMA',
});

// Cache TTL in seconds (1 hour)
const CACHE_TTL = 3600;

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin, Cache-Control');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Log the request for debugging
  console.log('Request URL:', req.url);
  console.log('Request Method:', req.method);
  
  // Get the endpoint from the query parameter
  const requestUrl = new URL(req.url, `https://${req.headers.host}`);
  const endpoint = requestUrl.searchParams.get('endpoint') || '';
  
  // Route to the appropriate handler based on the endpoint
  switch (endpoint) {
    case 'health':
      return handleHealthCheck(req, res);
    case 'basic-audit':
      return handleSeoAudit(req, res);
    default:
      // If no specific endpoint is provided, choose based on the method
      if (req.method === 'POST') {
        return handleSeoAudit(req, res);
      } else {
        return handleIndex(req, res);
      }
  }
};

// Index page handler - returns API status
async function handleIndex(req, res) {
  return res.status(200).json({
    status: 'ok',
    message: 'Marden SEO Audit API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      audit: '/api/basic-audit'
    },
    note: 'POST to /api/basic-audit with {"url":"your-website.com"} to run an audit'
  });
}

// Health check handler
async function handleHealthCheck(req, res) {
  let redisStatus = {
    status: 'disconnected',
    connected: false
  };

  try {
    // Test Redis connection by setting and getting a value
    await redis.set('health-check-test', 'ok');
    const testValue = await redis.get('health-check-test');
    
    redisStatus = {
      status: testValue === 'ok' ? 'connected' : 'error',
      connected: testValue === 'ok'
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
  res.status(200).json({
    redis: redisStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}

// SEO audit handler
async function handleSeoAudit(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract URL from request body with extra safety checks
    let requestBody = req.body;
    let url = null;
    
    // Handle different body formats
    if (requestBody) {
      if (typeof requestBody === 'object') {
        url = requestBody.url;
      } else if (typeof requestBody === 'string') {
        try {
          const parsed = JSON.parse(requestBody);
          url = parsed.url;
        } catch (e) {
          console.error('Failed to parse string body:', e);
        }
      }
    }
    
    console.log('Extracted URL for audit:', url);
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Normalize URL for consistent caching
    const normalizedUrl = normalizeUrl(url);
    
    // Check cache first
    const cacheKey = `seo-audit:${normalizedUrl}`;
    const cachedResult = await redis.get(cacheKey);
    
    if (cachedResult) {
      console.log(`Cache hit for ${normalizedUrl}`);
      return res.status(200).json(cachedResult);
    }
    
    console.log(`Cache miss for ${normalizedUrl}, performing audit...`);
    
    // Perform the actual SEO audit
    const auditResult = await performSeoAudit(normalizedUrl);
    
    // Cache the result
    await redis.set(cacheKey, auditResult, { ex: CACHE_TTL });
    
    // Set explicit content type
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(200).json(auditResult);
  } catch (error) {
    console.error('Error performing SEO audit:', error);
    return res.status(500).json({ 
      error: 'Failed to perform SEO audit', 
      details: error.message 
    });
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
async function performSeoAudit(url) {
  const startTime = Date.now();
  
  try {
    // Fetch the webpage
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'MardenSEOAuditBot/1.0',
      },
      timeout: 8000, // 8 seconds timeout (Vercel has 10s timeout on hobby plan)
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extract and analyze title
    const title = $('title').text().trim();
    const titleAnalysis = analyzeTitleTag(title);
    
    // Extract and analyze meta description
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const metaDescriptionAnalysis = analyzeMetaDescription(metaDescription);
    
    // Extract meta keywords
    const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
    
    // Extract canonical URL
    const canonicalUrl = $('link[rel="canonical"]').attr('href') || '';
    
    // Extract robots meta
    const robotsMeta = $('meta[name="robots"]').attr('content') || '';
    
    // Extract and analyze headings
    const headingsAnalysis = analyzeHeadings($);
    
    // Analyze content
    const contentAnalysis = analyzeContent($);
    
    // Analyze images
    const imageAnalysis = analyzeImages($);
    
    // Analyze links
    const linkAnalysis = analyzeLinks($, url);
    
    // Mobile responsiveness check (basic)
    const mobileAnalysis = {
      hasViewport: $('meta[name="viewport"]').length > 0,
      score: $('meta[name="viewport"]').length > 0 ? 100 : 0,
      issues: $('meta[name="viewport"]').length === 0 ? ['Missing viewport meta tag'] : [],
    };
    
    // Performance metrics (basic)
    const performanceAnalysis = {
      htmlSize: html.length,
      htmlSizeKB: (html.length / 1024).toFixed(2),
      loadTime: `${Date.now() - startTime}ms`,
      score: calculatePerformanceScore(html.length),
      issues: getPerformanceIssues(html.length, $),
    };
    
    // Social media tags
    const socialTags = analyzeSocialTags($);
    
    // Compile the overall score
    const overallScore = calculateOverallScore({
      titleAnalysis,
      metaDescriptionAnalysis,
      headingsAnalysis,
      contentAnalysis,
      imageAnalysis,
      linkAnalysis,
      mobileAnalysis,
      performanceAnalysis,
    });
    
    return {
      url,
      auditDate: new Date().toISOString(),
      overallScore,
      metrics: {
        title: titleAnalysis,
        metaDescription: metaDescriptionAnalysis,
        metaKeywords,
        canonicalUrl,
        robotsMeta,
        headings: headingsAnalysis,
        content: contentAnalysis,
        images: imageAnalysis,
        links: linkAnalysis,
        mobile: mobileAnalysis,
        performance: performanceAnalysis,
        socialTags,
      },
      summary: generateAuditSummary({
        titleAnalysis,
        metaDescriptionAnalysis,
        headingsAnalysis,
        contentAnalysis,
        imageAnalysis,
        linkAnalysis,
        mobileAnalysis,
        performanceAnalysis,
      })
    };
  } catch (error) {
    console.error(`Error fetching or analyzing ${url}:`, error);
    throw new Error(`Failed to analyze ${url}: ${error.message}`);
  }
}

// Title tag analysis
function analyzeTitleTag(title) {
  const length = title.length;
  const words = title.split(/\s+/).filter(Boolean).length;
  
  let score = 100;
  let issues = [];
  
  // Check length (ideal: 50-60 characters)
  if (length === 0) {
    score -= 100;
    issues.push('Missing title tag');
  } else if (length < 30) {
    score -= 20;
    issues.push('Title tag is too short (under 30 characters)');
  } else if (length > 60) {
    score -= 10;
    issues.push('Title tag is too long (over 60 characters)');
  }
  
  // Check for keyword stuffing
  if (words > 0 && length / words < 3.5) {
    score -= 15;
    issues.push('Potential keyword stuffing detected');
  }
  
  return {
    value: title,
    length,
    score: Math.max(0, score),
    issues,
  };
}

// Meta description analysis
function analyzeMetaDescription(description) {
  const length = description.length;
  
  let score = 100;
  let issues = [];
  
  // Check length (ideal: 120-160 characters)
  if (length === 0) {
    score -= 50;
    issues.push('Missing meta description');
  } else if (length < 70) {
    score -= 20;
    issues.push('Meta description is too short (under 70 characters)');
  } else if (length > 160) {
    score -= 10;
    issues.push('Meta description is too long (over 160 characters)');
  }
  
  return {
    value: description,
    length,
    score: Math.max(0, score),
    issues,
  };
}

// Headings analysis
function analyzeHeadings($) {
  const h1Count = $('h1').length;
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;
  const h4Count = $('h4').length;
  const h5Count = $('h5').length;
  const h6Count = $('h6').length;
  
  let score = 100;
  let issues = [];
  
  // Check H1 usage
  if (h1Count === 0) {
    score -= 30;
    issues.push('Missing H1 heading');
  } else if (h1Count > 1) {
    score -= 15;
    issues.push(`Multiple H1 headings found (${h1Count})`);
  }
  
  // Check heading structure
  if (h1Count > 0 && h2Count === 0 && (h3Count > 0 || h4Count > 0)) {
    score -= 10;
    issues.push('Improper heading structure (skipping H2)');
  }
  
  // Extract all headings for review
  const headings = [];
  $('h1, h2, h3, h4, h5, h6').each((i, el) => {
    const tag = el.name.toLowerCase();
    const text = $(el).text().trim();
    headings.push({ tag, text });
  });
  
  return {
    counts: { h1: h1Count, h2: h2Count, h3: h3Count, h4: h4Count, h5: h5Count, h6: h6Count },
    headings,
    score: Math.max(0, score),
    issues,
  };
}

// Content analysis
function analyzeContent($) {
  const bodyText = $('body').text().trim();
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  
  let score = 100;
  let issues = [];
  
  // Check content length
  if (wordCount < 300) {
    score -= 30;
    issues.push('Low word count (under 300 words)');
  }
  
  // Check paragraph structure
  const paragraphs = $('p').length;
  if (paragraphs < 3 && wordCount > 200) {
    score -= 15;
    issues.push('Few paragraph breaks detected');
  }
  
  // Check for lists (often good for readability)
  const listItems = $('ul li, ol li').length;
  if (listItems === 0 && wordCount > 500) {
    score -= 5;
    issues.push('No list elements found in long content');
  }
  
  return {
    wordCount,
    paragraphCount: paragraphs,
    listItemCount: listItems,
    score: Math.max(0, score),
    issues,
  };
}

// Image analysis
function analyzeImages($) {
  const images = [];
  let imagesWithAlt = 0;
  let imagesWithoutAlt = 0;
  
  $('img').each((i, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt') || '';
    const hasAlt = alt.trim().length > 0;
    
    images.push({
      src,
      alt,
      hasAlt,
    });
    
    if (hasAlt) {
      imagesWithAlt++;
    } else {
      imagesWithoutAlt++;
    }
  });
  
  let score = 100;
  let issues = [];
  
  // Check for missing alt text
  if (images.length > 0 && imagesWithoutAlt > 0) {
    const percentage = (imagesWithoutAlt / images.length) * 100;
    if (percentage > 50) {
      score -= 30;
      issues.push(`Most images (${percentage.toFixed(0)}%) are missing alt text`);
    } else if (imagesWithoutAlt > 0) {
      score -= 15;
      issues.push(`Some images (${imagesWithoutAlt}) are missing alt text`);
    }
  }
  
  return {
    totalCount: images.length,
    withAltText: imagesWithAlt,
    withoutAltText: imagesWithoutAlt,
    images: images.slice(0, 10), // Limit to first 10 for brevity
    score: Math.max(0, score),
    issues,
  };
}

// Link analysis
function analyzeLinks($, baseUrl) {
  const internalLinks = [];
  const externalLinks = [];
  let brokenLinks = 0; // Note: actual checking would require additional requests
  
  try {
    const baseUrlObj = new URL(baseUrl);
    
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      
      try {
        // Determine if internal or external
        let fullUrl;
        if (href.startsWith('http')) {
          fullUrl = href;
        } else if (href.startsWith('/')) {
          fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${href}`;
        } else {
          fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}/${href}`;
        }
        
        const linkUrlObj = new URL(fullUrl);
        const isInternal = linkUrlObj.hostname === baseUrlObj.hostname;
        
        const linkObj = {
          href,
          text: text || '[No Text]',
          fullUrl,
        };
        
        if (isInternal) {
          internalLinks.push(linkObj);
        } else {
          externalLinks.push(linkObj);
        }
      } catch (error) {
        brokenLinks++;
      }
    });
  } catch (error) {
    console.error('Error analyzing links:', error);
  }
  
  let score = 100;
  let issues = [];
  
  // Check for lack of internal links
  if (internalLinks.length < 3) {
    score -= 20;
    issues.push('Few internal links found (under 3)');
  }
  
  // Check for broken links (if any were detected)
  if (brokenLinks > 0) {
    score -= Math.min(50, 5 * brokenLinks);
    issues.push(`${brokenLinks} potentially broken or malformed links detected`);
  }
  
  return {
    internalCount: internalLinks.length,
    externalCount: externalLinks.length,
    brokenCount: brokenLinks,
    internalLinks: internalLinks.slice(0, 10), // Limit to first 10 for brevity
    externalLinks: externalLinks.slice(0, 10), // Limit to first 10 for brevity
    score: Math.max(0, score),
    issues,
  };
}

// Analyze social media tags
function analyzeSocialTags($) {
  const openGraph = {
    title: $('meta[property="og:title"]').attr('content') || '',
    description: $('meta[property="og:description"]').attr('content') || '',
    image: $('meta[property="og:image"]').attr('content') || '',
    url: $('meta[property="og:url"]').attr('content') || '',
    type: $('meta[property="og:type"]').attr('content') || '',
  };
  
  const twitter = {
    card: $('meta[name="twitter:card"]').attr('content') || '',
    title: $('meta[name="twitter:title"]').attr('content') || '',
    description: $('meta[name="twitter:description"]').attr('content') || '',
    image: $('meta[name="twitter:image"]').attr('content') || '',
  };
  
  let score = 100;
  let issues = [];
  
  // Check Open Graph
  if (!openGraph.title && !openGraph.description) {
    score -= 25;
    issues.push('Missing Open Graph tags');
  } else if (!openGraph.image) {
    score -= 10;
    issues.push('Missing Open Graph image');
  }
  
  // Check Twitter
  if (!twitter.card && !twitter.title && !twitter.description) {
    score -= 25;
    issues.push('Missing Twitter Card tags');
  }
  
  return {
    openGraph,
    twitter,
    score: Math.max(0, score),
    issues,
  };
}

// Calculate performance score
function calculatePerformanceScore(htmlSize) {
  let score = 100;
  
  // Penalize for large HTML size
  if (htmlSize > 100000) { // 100KB
    score -= 20;
  } else if (htmlSize > 50000) { // 50KB
    score -= 10;
  }
  
  return Math.max(0, score);
}

// Get performance issues
function getPerformanceIssues(htmlSize, $) {
  const issues = [];
  
  // Check HTML size
  if (htmlSize > 100000) {
    issues.push('HTML is too large (over 100KB)');
  } else if (htmlSize > 50000) {
    issues.push('HTML is moderately large (over 50KB)');
  }
  
  // Check for render-blocking resources
  const inlineStyles = $('style').length;
  const inlineScripts = $('script:not([src])').length;
  
  if (inlineStyles > 3) {
    issues.push(`Multiple inline style blocks detected (${inlineStyles})`);
  }
  
  if (inlineScripts > 3) {
    issues.push(`Multiple inline script blocks detected (${inlineScripts})`);
  }
  
  return issues;
}

// Calculate overall score based on individual metrics
function calculateOverallScore(metrics) {
  // Weight each category
  const weights = {
    titleAnalysis: 0.15,
    metaDescriptionAnalysis: 0.15,
    headingsAnalysis: 0.15,
    contentAnalysis: 0.2,
    imageAnalysis: 0.1,
    linkAnalysis: 0.1,
    mobileAnalysis: 0.1,
    performanceAnalysis: 0.05,
  };
  
  let weightedScore = 0;
  let totalWeight = 0;
  
  for (const [key, weight] of Object.entries(weights)) {
    if (metrics[key] && typeof metrics[key].score === 'number') {
      weightedScore += metrics[key].score * weight;
      totalWeight += weight;
    }
  }
  
  // Normalize to account for any missing metrics
  const normalizedScore = totalWeight > 0 ? (weightedScore / totalWeight) : 0;
  
  // Round to nearest integer
  return Math.round(normalizedScore);
}

// Generate a summary of the audit findings
function generateAuditSummary(metrics) {
  const issues = [];
  
  // Collect critical issues (low scores)
  Object.entries(metrics).forEach(([key, metric]) => {
    if (metric.score < 50 && metric.issues && metric.issues.length > 0) {
      issues.push(...metric.issues);
    }
  });
  
  // Create summary text
  let summary = '';
  
  if (issues.length === 0) {
    summary = 'The page is well-optimized for search engines. No critical issues found.';
  } else if (issues.length <= 3) {
    summary = `The page has a few SEO issues to address: ${issues.join(', ')}.`;
  } else {
    summary = `The page has several SEO issues that need attention. The most critical are: ${issues.slice(0, 3).join(', ')}.`;
  }
  
  return summary;
}
