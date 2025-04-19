// API handler with support for multiple endpoints
const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin, Cache-Control');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Parse the URL to determine the endpoint
  const path = req.url.split('?')[0];
  
  console.log(`Request received for path: ${path}, method: ${req.method}`);
  
  try {
    // Extract URL parameter from query string
    let targetUrl = null;
    
    if (req.method === 'GET') {
      const urlParts = req.url.split('?');
      if (urlParts.length > 1) {
        const queryParams = new URLSearchParams(urlParts[1]);
        targetUrl = queryParams.get('url');
      }
    } else if (req.method === 'POST' && req.body) {
      if (typeof req.body === 'object') {
        targetUrl = req.body.url;
      } else if (typeof req.body === 'string') {
        try {
          const parsed = JSON.parse(req.body);
          targetUrl = parsed.url;
        } catch (e) {
          console.error('Failed to parse body:', e);
        }
      }
    }
    
    // Handle different paths
    if (path === '/api/health') {
      return res.status(200).json({
        status: 'ok',
        axios: 'installed',
        message: 'Axios is installed and working',
        timestamp: new Date().toISOString()
      });
    } else if (path === '/api/seo-analyze' || path === '/api/real-seo-audit') {
      // These endpoints do real SEO analysis
      
      if (!targetUrl) {
        return res.status(400).json({
          error: 'Missing URL parameter',
          message: 'URL is required'
        });
      }
      
      // Normalize URL
      if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl;
      }
      
      try {
        console.log(`Performing SEO analysis for ${targetUrl}`);
        const response = await axios.get(targetUrl, {
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
          url: targetUrl,
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
      } catch (fetchError) {
        return res.status(400).json({
          error: 'Failed to fetch URL',
          details: fetchError.message,
          url: targetUrl
        });
      }
    } else if (path === '/api/basic-audit') {
      // Legacy basic audit endpoint
      
      if (!targetUrl) {
        return res.status(400).json({
          error: 'Missing URL parameter',
          message: 'URL is required'
        });
      }
      
      // Normalize URL
      if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl;
      }
      
      // Basic test of axios functionality
      try {
        console.log(`Testing axios by fetching ${targetUrl}`);
        const response = await axios.get(targetUrl, {
          timeout: 8000,
          headers: {
            'User-Agent': 'MardenSEOAuditBot/1.0 (+https://audit.mardenseo.com)'
          }
        });
        
        // Create a basic response with just title info
        const title = response.data.match(/<title[^>]*>(.*?)<\/title>/is)?.[1] || 'No title found';
        
        return res.status(200).json({
          url: targetUrl,
          axiosWorking: true,
          basicInfo: {
            title,
            status: response.status,
            contentType: response.headers['content-type'],
            size: response.data.length
          },
          message: 'Axios successfully fetched the target URL',
          timestamp: new Date().toISOString()
        });
      } catch (fetchError) {
        return res.status(200).json({
          url: targetUrl,
          axiosWorking: true,
          error: 'Failed to fetch URL',
          message: fetchError.message,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      // Default route
      return res.status(200).json({
        status: 'ok',
        message: 'API is running. Axios is installed.',
        endpoints: {
          health: '/api/health',
          basic: '/api/basic-audit?url=example.com',
          seo: '/api/seo-analyze?url=example.com',
          real: '/api/real-seo-audit?url=example.com'
        },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error handling request:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};