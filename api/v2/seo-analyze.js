// SEO Analyze endpoint for API v2
const axios = require('axios');
const cheerio = require('cheerio');
const { normalizeUrl, getCachedData, cacheData } = require('../lib/redis.js');

/**
 * Analyze a URL for SEO factors
 */
async function analyzeSeo(url) {
  try {
    console.log(`Analyzing SEO for ${url}`);
    
    // Fetch the page
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'MardenSEOAuditBot/1.0 (+https://audit.mardenseo.com)'
      }
    });
    
    // Load content into cheerio
    const $ = cheerio.load(response.data);
    
    // Extract key SEO elements
    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const h1Text = $('h1').first().text().trim();
    const h1Count = $('h1').length;
    const h2Count = $('h2').length;
    const canonicalTag = $('link[rel="canonical"]').attr('href') || '';
    const robotsTag = $('meta[name="robots"]').attr('content') || '';
    
    // Extract headings
    const headings = {
      h1: [],
      h2: [],
      h3: []
    };
    
    $('h1').each((i, el) => {
      headings.h1.push($(el).text().trim());
    });
    
    $('h2').each((i, el) => {
      headings.h2.push($(el).text().trim());
    });
    
    $('h3').each((i, el) => {
      headings.h3.push($(el).text().trim());
    });
    
    // Extract images without alt text
    const imagesWithoutAlt = [];
    $('img').each((i, el) => {
      const alt = $(el).attr('alt');
      const src = $(el).attr('src');
      if (!alt && src) {
        imagesWithoutAlt.push(src);
      }
    });
    
    // Count links
    const links = {
      internal: 0,
      external: 0,
      total: 0
    };
    
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        return;
      }
      
      try {
        const linkUrl = new URL(href, url);
        
        if (linkUrl.hostname === new URL(url).hostname) {
          links.internal++;
        } else {
          links.external++;
        }
        
        links.total++;
      } catch (error) {
        // Skip malformed URLs
      }
    });
    
    // Calculate content statistics
    let contentText = $('body').text().trim();
    contentText = contentText.replace(/\\s+/g, ' ');
    const wordCount = contentText.split(/\\s+/).length;
    const contentLength = contentText.length;
    
    // Check for structured data
    const structuredData = [];
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const jsonText = $(el).html();
        const json = JSON.parse(jsonText);
        structuredData.push({
          type: json['@type'] || 'Unknown',
          data: json
        });
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    // Check for schema.org microdata
    const hasMicrodata = $('[itemscope]').length > 0;
    
    // Calculate score based on factors
    let score = 100;
    const issues = [];
    
    // Title checks
    if (!title) {
      score -= 20;
      issues.push({
        type: 'missing_title',
        severity: 'critical',
        recommendation: 'Add a title tag to your page'
      });
    } else if (title.length < 30) {
      score -= 10;
      issues.push({
        type: 'title_too_short',
        severity: 'warning',
        current: title,
        recommendation: 'Make your title tag longer (30-60 characters recommended)'
      });
    } else if (title.length > 60) {
      score -= 5;
      issues.push({
        type: 'title_too_long',
        severity: 'info',
        current: title,
        recommendation: 'Consider shortening your title tag (30-60 characters recommended)'
      });
    }
    
    // Meta description checks
    if (!metaDescription) {
      score -= 15;
      issues.push({
        type: 'missing_meta_description',
        severity: 'critical',
        recommendation: 'Add a meta description to your page'
      });
    } else if (metaDescription.length < 50) {
      score -= 10;
      issues.push({
        type: 'meta_description_too_short',
        severity: 'warning',
        current: metaDescription,
        recommendation: 'Make your meta description longer (50-160 characters recommended)'
      });
    } else if (metaDescription.length > 160) {
      score -= 5;
      issues.push({
        type: 'meta_description_too_long',
        severity: 'info',
        current: metaDescription,
        recommendation: 'Consider shortening your meta description (50-160 characters recommended)'
      });
    }
    
    // H1 checks
    if (h1Count === 0) {
      score -= 15;
      issues.push({
        type: 'missing_h1',
        severity: 'critical',
        recommendation: 'Add an H1 heading to your page'
      });
    } else if (h1Count > 1) {
      score -= 10;
      issues.push({
        type: 'multiple_h1',
        severity: 'warning',
        current: h1Count,
        recommendation: 'Use only one H1 heading per page'
      });
    }
    
    // Content length check
    if (wordCount < 300) {
      score -= 10;
      issues.push({
        type: 'thin_content',
        severity: 'warning',
        current: wordCount,
        recommendation: 'Add more content to your page (aim for at least 300 words)'
      });
    }
    
    // Image alt text check
    if (imagesWithoutAlt.length > 0) {
      score -= Math.min(15, imagesWithoutAlt.length * 3);
      issues.push({
        type: 'images_missing_alt',
        severity: 'warning',
        count: imagesWithoutAlt.length,
        recommendation: 'Add alt text to all images for better accessibility and SEO'
      });
    }
    
    // Canonical check
    if (!canonicalTag) {
      score -= 5;
      issues.push({
        type: 'missing_canonical',
        severity: 'info',
        recommendation: 'Add a canonical tag to indicate the preferred version of this page'
      });
    }
    
    // Structured data check
    if (structuredData.length === 0 && !hasMicrodata) {
      score -= 5;
      issues.push({
        type: 'no_structured_data',
        severity: 'info',
        recommendation: 'Add structured data to help search engines understand your content'
      });
    }
    
    // Ensure score stays within 0-100 range
    score = Math.max(0, Math.min(100, score));
    
    // Determine overall status
    let status = 'good';
    if (score < 50) {
      status = 'poor';
    } else if (score < 80) {
      status = 'needs_improvement';
    }
    
    // Return analysis results
    return {
      url,
      score,
      status,
      issues,
      metadata: {
        title: {
          text: title,
          length: title.length
        },
        metaDescription: {
          text: metaDescription,
          length: metaDescription.length
        },
        canonical: canonicalTag,
        robots: robotsTag
      },
      content: {
        wordCount,
        contentLength,
        headings,
        links,
        imagesWithoutAlt: imagesWithoutAlt.length
      },
      technical: {
        hasStructuredData: structuredData.length > 0 || hasMicrodata,
        structuredDataTypes: structuredData.map(item => item.type)
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error analyzing SEO for ${url}:`, error);
    throw error;
  }
}

// SEO Analyze handler
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin, Cache-Control');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: 'error',
      message: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    // Extract request body
    let requestBody = req.body;
    
    // Parse body if it's a string
    if (typeof requestBody === 'string') {
      try {
        requestBody = JSON.parse(requestBody);
      } catch (e) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid JSON in request body',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Get URL from request body
    const { url } = requestBody;
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate URL format
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    try {
      new URL(normalizedUrl);
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid URL provided',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check cache first as per Cache-First Strategy (requirement #4)
    const urlKey = normalizeUrl(normalizedUrl);
    const cachedData = await getCachedData('analyze', urlKey);
    
    if (cachedData) {
      console.log(`Serving cached SEO analysis for ${url}`);
      return res.status(200).json({
        status: 'ok',
        message: 'SEO analysis retrieved from cache',
        url: normalizedUrl,
        cached: true,
        cachedAt: cachedData.cachedAt,
        timestamp: new Date().toISOString(),
        data: cachedData
      });
    }
    
    // Perform analysis
    console.log(`Performing SEO analysis for ${normalizedUrl}`);
    const analysisResults = await analyzeSeo(normalizedUrl);
    
    // Cache results (15 minutes TTL per requirement #8)
    await cacheData('analyze', urlKey, analysisResults, 900);
    
    // Return analysis results
    return res.status(200).json({
      status: 'ok',
      message: 'SEO analysis completed',
      url: normalizedUrl,
      cached: false,
      timestamp: new Date().toISOString(),
      data: analysisResults
    });
  } catch (error) {
    console.error('Error performing SEO analysis:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to perform SEO analysis',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};