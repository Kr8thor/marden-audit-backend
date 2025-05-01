// Quick SEO analysis endpoint
const axios = require('axios');
const cheerio = require('cheerio');
const { normalizeUrl, getCachedData, cacheData } = require('../lib/redis.js');

// Cache TTL for quick SEO analysis (15 minutes)
const QUICK_ANALYSIS_CACHE_TTL = 15 * 60;

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
    
    // Check cache first
    const urlKey = normalizeUrl(normalizedUrl);
    const cachedData = await getCachedData('quick-seo', urlKey);
    
    if (cachedData) {
      console.log(`Serving cached quick SEO analysis for ${url}`);
      return res.status(200).json({
        status: 'ok',
        message: 'Quick SEO analysis retrieved from cache',
        url: normalizedUrl,
        cached: true,
        cachedAt: cachedData.cachedAt,
        timestamp: new Date().toISOString(),
        ...cachedData
      });
    }
    
    // Fetch page content
    console.log(`Performing quick SEO analysis for ${normalizedUrl}`);
    const response = await axios.get(normalizedUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'MardenSEOAuditBot/1.0 (+https://audit.mardenseo.com)'
      }
    });
    
    // Parse with cheerio
    const $ = cheerio.load(response.data);
    
    // Extract SEO elements
    const titleText = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const canonicalUrl = $('link[rel="canonical"]').attr('href') || '';
    const hreflangLinks = [];
    $('link[rel="alternate"][hreflang]').each((i, el) => {
      hreflangLinks.push({
        hreflang: $(el).attr('hreflang'),
        href: $(el).attr('href')
      });
    });
    
    // Extract headings
    const h1Elements = $('h1');
    const h2Elements = $('h2');
    const h3Elements = $('h3');
    
    const h1Texts = [];
    h1Elements.each((i, el) => {
      h1Texts.push($(el).text().trim());
    });
    
    const h2Texts = [];
    h2Elements.each((i, el) => {
      h2Texts.push($(el).text().trim());
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
    
    // Calculate total content length
    let contentText = $('body').text().trim();
    contentText = contentText.replace(/\\s+/g, ' ');
    const contentLength = contentText.length;
    
    // Count internal and external links
    const internalLinks = [];
    const externalLinks = [];
    
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        return;
      }
      
      try {
        const linkUrl = new URL(href, normalizedUrl);
        
        if (linkUrl.hostname === new URL(normalizedUrl).hostname) {
          internalLinks.push(linkUrl.href);
        } else {
          externalLinks.push(linkUrl.href);
        }
      } catch (error) {
        // Skip malformed URLs
      }
    });
    
    // Calculate score
    let score = 100;
    let issuesFound = 0;
    
    // Title checks
    if (!titleText) {
      score -= 25;
      issuesFound++;
    } else if (titleText.length < 30) {
      score -= 10;
      issuesFound++;
    } else if (titleText.length > 60) {
      score -= 5;
      issuesFound++;
    }
    
    // Meta description checks
    if (!metaDescription) {
      score -= 15;
      issuesFound++;
    } else if (metaDescription.length < 50) {
      score -= 10;
      issuesFound++;
    } else if (metaDescription.length > 160) {
      score -= 5;
      issuesFound++;
    }
    
    // Heading checks
    if (h1Elements.length === 0) {
      score -= 15;
      issuesFound++;
    } else if (h1Elements.length > 1) {
      score -= 10;
      issuesFound++;
    }
    
    if (h2Elements.length === 0) {
      score -= 5;
      issuesFound++;
    }
    
    // Image alt text checks
    if (imagesWithoutAlt.length > 0) {
      score -= Math.min(15, imagesWithoutAlt.length * 3);
      issuesFound++;
    }
    
    // Content length check
    if (contentLength < 300) {
      score -= 10;
      issuesFound++;
    }
    
    // Canonical check
    if (!canonicalUrl) {
      score -= 5;
      issuesFound++;
    }
    
    // Ensure score stays within 0-100 range
    score = Math.max(0, Math.min(100, score));
    
    // Create analysis result
    const analysisResult = {
      url: normalizedUrl,
      score,
      issuesFound,
      opportunities: Math.max(0, issuesFound - 1),
      pageAnalysis: {
        title: {
          text: titleText,
          length: titleText.length
        },
        metaDescription: {
          text: metaDescription,
          length: metaDescription.length
        },
        headings: {
          h1Count: h1Elements.length,
          h1Texts: h1Texts.slice(0, 5), // First 5 H1 texts
          h2Count: h2Elements.length,
          h2Texts: h2Texts.slice(0, 5),  // First 5 H2 texts
          h3Count: h3Elements.length
        },
        links: {
          internalCount: internalLinks.length,
          externalCount: externalLinks.length,
          totalCount: internalLinks.length + externalLinks.length
        },
        images: {
          withoutAltCount: imagesWithoutAlt.length
        },
        contentLength,
        canonical: canonicalUrl,
        hreflang: hreflangLinks
      }
    };
    
    // Cache the result
    await cacheData('quick-seo', urlKey, analysisResult, QUICK_ANALYSIS_CACHE_TTL);
    
    // Return analysis result
    return res.status(200).json({
      status: 'ok',
      message: 'Quick SEO analysis completed',
      timestamp: new Date().toISOString(),
      cached: false,
      ...analysisResult
    });
  } catch (error) {
    console.error('Error performing quick SEO analysis:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to perform quick SEO analysis',
      error: error.message,
      url: req.body?.url,
      timestamp: new Date().toISOString()
    });
  }
};