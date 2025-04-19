// Complete implementation of /api/basic-audit.js with comprehensive SEO analysis
const axios = require('axios');
const cheerio = require('cheerio');

// Try to initialize Redis, but handle missing configuration gracefully
let redisClient = null;
try {
  const { Redis } = require('@upstash/redis');
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('Redis client initialized successfully');
  } else {
    console.log('Redis environment variables are not set');
  }
} catch (error) {
  console.error('Failed to initialize Redis client:', error.message);
}

// Set cache expiration time (1 hour)
const CACHE_EXPIRY = 3600;

// Calculate SEO score based on analysis
function calculateScore(analysis) {
  let score = 100;
  const { title, metaDescription, headings } = analysis;
  
  // Title checks
  if (!title.text) {
    score -= 25; // No title is a serious issue
  } else if (title.length < 30) {
    score -= 10; // Title too short
  } else if (title.length > 60) {
    score -= 5; // Title too long
  }
  
  // Meta description checks
  if (!metaDescription.text) {
    score -= 15; // No meta description
  } else if (metaDescription.length < 50) {
    score -= 10; // Meta description too short
  } else if (metaDescription.length > 160) {
    score -= 5; // Meta description too long
  }
  
  // Heading checks
  if (headings.h1Count === 0) {
    score -= 15; // No H1 heading
  } else if (headings.h1Count > 1) {
    score -= 10; // Multiple H1 headings
  }
  
  if (headings.h2Count === 0) {
    score -= 5; // No H2 headings
  }
  
  // Ensure score stays within 0-100 range
  return Math.max(0, Math.min(100, score));
}

// Analyze page HTML
function analyzePage(html, url) {
  const $ = cheerio.load(html);
  
  // Extract title
  const titleText = $('title').text().trim();
  
  // Extract meta description
  const metaDescription = $('meta[name="description"]').attr('content') || '';
  
  // Extract headings
  const h1Elements = $('h1');
  const h2Elements = $('h2');
  
  const h1Texts = [];
  h1Elements.each((i, el) => {
    h1Texts.push($(el).text().trim());
  });
  
  const h2Texts = [];
  h2Elements.each((i, el) => {
    h2Texts.push($(el).text().trim());
  });
  
  const pageAnalysis = {
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
      h1Texts: h1Texts,
      h2Count: h2Elements.length,
      h2Texts: h2Texts
    }
  };
  
  // Calculate score
  const score = calculateScore(pageAnalysis);
  
  return {
    url,
    score,
    realDataFlag: true,
    cached: false,
    pageAnalysis
  };
}

// Async function to check cache
async function checkCache(key) {
  if (!redisClient) return null;
  
  try {
    return await redisClient.get(key);
  } catch (error) {
    console.error('Failed to check cache:', error.message);
    return null;
  }
}

// Async function to set cache
async function setCache(key, value, expiry) {
  if (!redisClient) return false;
  
  try {
    await redisClient.set(key, value, { ex: expiry });
    return true;
  } catch (error) {
    console.error('Failed to set cache:', error.message);
    return false;
  }
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get URL from query parameter
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Normalize URL for caching
    const normalizedUrl = url.toLowerCase().trim();
    
    // Check cache
    const cacheKey = `seo_audit:${normalizedUrl}`;
    const cachedData = await checkCache(cacheKey);
    
    if (cachedData) {
      // Return cached data with cached flag set to true
      console.log('Cache hit for:', normalizedUrl);
      return res.status(200).json({ ...cachedData, cached: true });
    }
    
    // Fetch the URL content
    console.log('Fetching content for:', normalizedUrl);
    let response;
    try {
      response = await axios.get(normalizedUrl, {
        headers: {
          'User-Agent': 'SEOAuditBot/1.0 (+https://mardenseo.com/bot)',
          'Accept': 'text/html'
        },
        timeout: 10000 // 10 second timeout
      });
    } catch (fetchError) {
      console.error('Fetch error:', fetchError.message);
      return res.status(400).json({
        error: 'Failed to fetch URL',
        details: fetchError.message,
        url: normalizedUrl
      });
    }
    
    // Check if response is HTML
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('text/html')) {
      console.error('Non-HTML content type:', contentType);
      return res.status(400).json({
        error: 'URL does not return HTML content',
        contentType,
        url: normalizedUrl
      });
    }
    
    // Parse and analyze the HTML
    console.log('Analyzing content for:', normalizedUrl);
    const html = response.data;
    const result = analyzePage(html, normalizedUrl);
    
    // Cache the result
    if (redisClient) {
      console.log('Caching result for:', normalizedUrl);
      await setCache(cacheKey, result, CACHE_EXPIRY);
    } else {
      console.log('Skipping cache - Redis not available');
    }
    
    // Return the analysis result
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('SEO Audit Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};