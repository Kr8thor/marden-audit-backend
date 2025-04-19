// Basic test router to help debug API issues
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
    console.log('Fetching content for:', normalizedUrl);
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
    
    // Parse HTML with cheerio
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extract basic info
    const titleText = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const h1Count = $('h1').length;
    const h2Count = $('h2').length;
    
    // Return the analysis result
    return res.status(200).json({
      url: normalizedUrl,
      score: 85, // Example score
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
          h1Count,
          h2Count
        }
      }
    });
    
  } catch (error) {
    console.error('SEO Audit Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};