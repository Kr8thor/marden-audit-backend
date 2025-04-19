// /api/basic-audit.js
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
  
  // Start timing the request for performance metrics
  const startTime = Date.now();
  
  try {
    // Extract URL - Handle both GET and POST methods
    let url = null;
    
    if (req.method === 'GET') {
      // For GET requests, extract URL from query parameters
      url = req.query.url;
      console.log('GET request received with URL:', url);
    } else if (req.method === 'POST') {
      // For POST requests, extract URL from request body (handling different formats)
      let requestBody = req.body;
      
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
      console.log('POST request received with URL:', url);
    } else {
      // Reject other methods
      return res.status(405).json({
        error: 'Method not allowed',
        message: 'This endpoint only accepts GET and POST requests'
      });
    }
    
    if (!url) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'URL is required'
      });
    }

    // Normalize URL for consistent caching
    const normalizedUrl = normalizeUrl(url);
    
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
    
    // Extract and analyze title
    const title = $('title').text().trim();
    const titleLength = title.length;
    
    // Extract and analyze meta description
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const descriptionLength = metaDescription.length;
    
    // Extract meta keywords
    const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
    
    // Extract canonical URL
    const canonicalUrl = $('link[rel="canonical"]').attr('href') || '';
    
    // Extract robots meta
    const robotsMeta = $('meta[name="robots"]').attr('content') || '';
    
    // Extract and analyze headings
    const h1Count = $('h1').length;
    const h2Count = $('h2').length;
    const h3Count = $('h3').length;
    
    // Analyze content
    const bodyText = $('body').text().trim();
    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
    
    // Analyze images
    const images = $('img').length;
    const imagesWithAlt = $('img[alt]').length;
    const imagesWithoutAlt = images - imagesWithAlt;
    
    // Analyze links
    const internalLinks = [];
    const externalLinks = [];
    
    try {
      const baseUrlObj = new URL(url);
      const domain = baseUrlObj.hostname;
      
      $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (!href || href.startsWith('#')) return;
        
        try {
          let linkUrl;
          if (href.startsWith('http')) {
            linkUrl = href;
          } else if (href.startsWith('/')) {
            linkUrl = `${baseUrlObj.protocol}//${domain}${href}`;
          } else {
            linkUrl = `${baseUrlObj.protocol}//${domain}/${href}`;
          }
          
          const linkUrlObj = new URL(linkUrl);
          if (linkUrlObj.hostname === domain) {
            internalLinks.push(linkUrl);
          } else {
            externalLinks.push(linkUrl);
          }
        } catch (e) {
          // Malformed URL, ignore
        }
      });
    } catch (e) {
      console.error('Error analyzing links:', e);
    }
    
    // Mobile responsiveness check (basic)
    const hasViewport = $('meta[name="viewport"]').length > 0;
    
    // Check for HTTPS
    const isHttps = url.startsWith('https://');
    
    // Calculate scores for each category
    const metaScore = calculateMetaScore(title, metaDescription);
    const contentScore = calculateContentScore(wordCount, h1Count, h2Count);
    const imageScore = calculateImageScore(images, imagesWithAlt);
    const linkScore = calculateLinkScore(internalLinks.length, externalLinks.length);
    const technicalScore = calculateTechnicalScore(isHttps, hasViewport);
    
    // Calculate overall score (weighted average)
    const overallScore = Math.round(
      (metaScore * 0.25) + 
      (contentScore * 0.25) + 
      (imageScore * 0.15) + 
      (linkScore * 0.15) + 
      (technicalScore * 0.2)
    );
    
    // Collect issues
    const issues = [];
    
    if (titleLength === 0) issues.push('Missing title tag');
    else if (titleLength < 30) issues.push('Title is too short (under 30 characters)');
    else if (titleLength > 60) issues.push('Title is too long (over 60 characters)');
    
    if (descriptionLength === 0) issues.push('Missing meta description');
    else if (descriptionLength < 70) issues.push('Meta description is too short (under 70 characters)');
    else if (descriptionLength > 160) issues.push('Meta description is too long (over 160 characters)');
    
    if (h1Count === 0) issues.push('Missing H1 heading');
    else if (h1Count > 1) issues.push(`Multiple H1 headings (${h1Count}) found`);
    
    if (wordCount < 300) issues.push('Low content volume (less than 300 words)');
    
    if (imagesWithoutAlt > 0) issues.push(`${imagesWithoutAlt} images missing alt text`);
    
    if (internalLinks.length < 3) issues.push('Few internal links detected');
    
    if (!hasViewport) issues.push('Missing viewport meta tag');
    
    if (!isHttps) issues.push('Not using HTTPS');
    
    if (!canonicalUrl) issues.push('Missing canonical URL');
    
    // Generate summary
    let summary = 'The page is well-optimized for search engines.';
    if (issues.length > 0) {
      summary = `The page has ${issues.length} SEO issues to address: ${issues.slice(0, 3).join(', ')}${issues.length > 3 ? '...' : '.'}`;
    }
    
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
        meta: {
          title: {
            value: title,
            length: titleLength
          },
          metaDescription: {
            value: metaDescription,
            length: descriptionLength
          },
          metaKeywords,
          canonicalUrl,
          robotsMeta,
          score: metaScore,
          issues: getMetaIssues(title, metaDescription, canonicalUrl)
        },
        headings: {
          counts: {
            h1: h1Count,
            h2: h2Count,
            h3: h3Count
          },
          score: h1Count === 1 ? 100 : (h1Count === 0 ? 0 : 50),
          issues: getHeadingIssues(h1Count, h2Count)
        },
        content: {
          wordCount,
          score: contentScore,
          issues: getContentIssues(wordCount)
        },
        images: {
          totalCount: images,
          withAltText: imagesWithAlt,
          withoutAltText: imagesWithoutAlt,
          score: imageScore,
          issues: getImageIssues(images, imagesWithAlt)
        },
        links: {
          internalCount: internalLinks.length,
          externalCount: externalLinks.length,
          score: linkScore,
          issues: getLinkIssues(internalLinks.length)
        },
        mobile: {
          hasViewport,
          score: hasViewport ? 100 : 0,
          issues: hasViewport ? [] : ['Missing viewport meta tag']
        },
        technical: {
          isHttps,
          score: technicalScore,
          issues: getTechnicalIssues(isHttps, hasViewport)
        }
      },
      summary: {
        text: summary,
        issueCount: issues.length,
        topIssues: issues.slice(0, 5).map(issue => ({ issue }))
      }
    };
  } catch (error) {
    console.error(`Error in SEO audit for ${url}:`, error);
    throw error; // Re-throw to be handled by the main handler
  }
}

// Score calculation functions
function calculateMetaScore(title, metaDescription) {
  let score = 100;
  
  if (!title) score -= 50;
  else if (title.length < 30 || title.length > 60) score -= 25;
  
  if (!metaDescription) score -= 50;
  else if (metaDescription.length < 70 || metaDescription.length > 160) score -= 25;
  
  return Math.max(0, score);
}

function calculateContentScore(wordCount, h1Count, h2Count) {
  let score = 100;
  
  if (wordCount < 300) score -= 30;
  if (h1Count !== 1) score -= 30;
  if (h2Count < 2) score -= 20;
  
  return Math.max(0, score);
}

function calculateImageScore(totalImages, imagesWithAlt) {
  if (totalImages === 0) return 100; // No images is not a problem
  
  const percentage = (imagesWithAlt / totalImages) * 100;
  return Math.round(percentage);
}

function calculateLinkScore(internalCount, externalCount) {
  let score = 100;
  
  if (internalCount < 3) score -= 30;
  if (externalCount === 0) score -= 10; // External links can be good for SEO
  
  return Math.max(0, score);
}

function calculateTechnicalScore(isHttps, hasViewport) {
  let score = 100;
  
  if (!isHttps) score -= 50;
  if (!hasViewport) score -= 50;
  
  return Math.max(0, score);
}

// Issue collection functions
function getMetaIssues(title, metaDescription, canonicalUrl) {
  const issues = [];
  
  if (!title) {
    issues.push('Missing title tag');
  } else if (title.length < 30) {
    issues.push('Title is too short (under 30 characters)');
  } else if (title.length > 60) {
    issues.push('Title is too long (over 60 characters)');
  }
  
  if (!metaDescription) {
    issues.push('Missing meta description');
  } else if (metaDescription.length < 70) {
    issues.push('Meta description is too short (under 70 characters)');
  } else if (metaDescription.length > 160) {
    issues.push('Meta description is too long (over 160 characters)');
  }
  
  if (!canonicalUrl) {
    issues.push('Missing canonical URL');
  }
  
  return issues;
}

function getHeadingIssues(h1Count, h2Count) {
  const issues = [];
  
  if (h1Count === 0) {
    issues.push('Missing H1 heading');
  } else if (h1Count > 1) {
    issues.push(`Multiple H1 headings (${h1Count}) found`);
  }
  
  if (h2Count === 0) {
    issues.push('No H2 headings found');
  }
  
  return issues;
}

function getContentIssues(wordCount) {
  const issues = [];
  
  if (wordCount < 300) {
    issues.push('Low content volume (less than 300 words)');
  }
  
  return issues;
}

function getImageIssues(totalImages, imagesWithAlt) {
  const issues = [];
  const imagesWithoutAlt = totalImages - imagesWithAlt;
  
  if (totalImages > 0 && imagesWithoutAlt > 0) {
    issues.push(`${imagesWithoutAlt} images missing alt text`);
  }
  
  return issues;
}

function getLinkIssues(internalCount) {
  const issues = [];
  
  if (internalCount < 3) {
    issues.push('Few internal links detected (less than 3)');
  }
  
  return issues;
}

function getTechnicalIssues(isHttps, hasViewport) {
  const issues = [];
  
  if (!isHttps) {
    issues.push('Not using HTTPS');
  }
  
  if (!hasViewport) {
    issues.push('Missing viewport meta tag');
  }
  
  return issues;
}
