// Basic SEO analyze endpoint
const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
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
    // Extract URL from request body
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
    
    const { url } = requestBody;
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Normalize URL
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    
    // Fetch and analyze the page
    try {
      const response = await axios.get(normalizedUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'MardenSEOAuditBot/1.0'
        }
      });
      
      // Parse with cheerio
      const $ = cheerio.load(response.data);
      
      // Extract basic SEO elements
      const title = $('title').text().trim();
      const metaDescription = $('meta[name="description"]').attr('content') || '';
      const h1Count = $('h1').length;
      const h2Count = $('h2').length;
      
      // Extract headings
      const h1Texts = [];
      $('h1').each((i, el) => {
        h1Texts.push($(el).text().trim());
      });
      
      const h2Texts = [];
      $('h2').each((i, el) => {
        h2Texts.push($(el).text().trim());
      });
      
      // Count images without alt
      let imagesWithoutAlt = 0;
      $('img').each((i, el) => {
        if (!$(el).attr('alt')) {
          imagesWithoutAlt++;
        }
      });
      
      // Simple scoring
      let score = 100;
      let issuesFound = 0;
      
      // Title checks
      if (!title) {
        score -= 20;
        issuesFound++;
      } else if (title.length < 20 || title.length > 60) {
        score -= 10;
        issuesFound++;
      }
      
      // Meta description checks
      if (!metaDescription) {
        score -= 15;
        issuesFound++;
      } else if (metaDescription.length < 50 || metaDescription.length > 160) {
        score -= 10;
        issuesFound++;
      }
      
      // H1 checks
      if (h1Count === 0) {
        score -= 15;
        issuesFound++;
      } else if (h1Count > 1) {
        score -= 10;
        issuesFound++;
      }
      
      // Images without alt text
      if (imagesWithoutAlt > 0) {
        score -= Math.min(15, imagesWithoutAlt * 2);
        issuesFound++;
      }
      
      // Ensure score stays within 0-100 range
      score = Math.max(0, Math.min(100, score));
      
      // Return results
      return res.status(200).json({
        status: 'ok',
        message: 'SEO analysis completed',
        url: normalizedUrl,
        timestamp: new Date().toISOString(),
        data: {
          url: normalizedUrl,
          score,
          issuesFound,
          opportunities: Math.max(0, issuesFound - 1),
          pageAnalysis: {
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
              h1Texts: h1Texts.slice(0, 5),
              h2Count,
              h2Texts: h2Texts.slice(0, 5)
            },
            images: {
              withoutAltCount: imagesWithoutAlt
            }
          }
        }
      });
    } catch (error) {
      console.error(`Error analyzing URL ${normalizedUrl}:`, error);
      return res.status(500).json({
        status: 'error',
        message: `Error analyzing URL: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error in SEO analysis:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};