// /api/basic-audit.js
const axios = require('axios');

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
  
  console.log('basic-audit endpoint called, method:', req.method);
  
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
    const metaDescription = response.data.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] || '';
    
    return res.status(200).json({
      url: targetUrl,
      auditDate: new Date().toISOString(),
      overallScore: 75, // Simplified score
      metrics: {
        meta: {
          title: {
            value: title,
            length: title.length
          },
          metaDescription: {
            value: metaDescription,
            length: metaDescription.length
          },
          score: 80,
          issues: []
        },
        content: {
          wordCount: response.data.length / 6, // Rough estimation
          score: 70,
          issues: []
        }
      },
      summary: {
        text: "Basic analysis completed successfully. Axios is working!",
        issueCount: 0,
        topIssues: []
      }
    });
  } catch (error) {
    console.error('Error fetching URL:', error);
    return res.status(500).json({
      error: 'Failed to analyze URL',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
