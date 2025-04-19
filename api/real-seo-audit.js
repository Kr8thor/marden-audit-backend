// Complete implementation of real SEO audit endpoint
const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Get URL from query parameter
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Normalize URL
    const normalizedUrl = url.toLowerCase().trim();
    
    // Fetch the URL content
    let response;
    try {
      response = await axios.get(normalizedUrl, {
        headers: {
          'User-Agent': 'SEOAuditBot/1.0',
          'Accept': 'text/html'
        },
        timeout: 10000 // 10 second timeout
      });
    } catch (fetchError) {
      return res.status(400).json({
        error: 'Failed to fetch URL',
        details: fetchError.message,
        url: normalizedUrl
      });
    }
    
    // Parse HTML with cheerio
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extract SEO elements
    const titleText = $('title').text().trim();
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
    
    // Calculate score
    let score = 100;
    
    // Title checks
    if (!titleText) {
      score -= 25;
    } else if (titleText.length < 30) {
      score -= 10;
    } else if (titleText.length > 60) {
      score -= 5;
    }
    
    // Meta description checks
    if (!metaDescription) {
      score -= 15;
    } else if (metaDescription.length < 50) {
      score -= 10;
    } else if (metaDescription.length > 160) {
      score -= 5;
    }
    
    // Heading checks
    if (h1Elements.length === 0) {
      score -= 15;
    } else if (h1Elements.length > 1) {
      score -= 10;
    }
    
    if (h2Elements.length === 0) {
      score -= 5;
    }
    
    // Ensure score stays within 0-100 range
    score = Math.max(0, Math.min(100, score));
    
    // Return analysis result
    return res.status(200).json({
      url: normalizedUrl,
      score,
      realDataFlag: true,
      cached: false,
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
          h2Texts: h2Texts.slice(0, 5)  // First 5 H2 texts
        }
      }
    });
    
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};