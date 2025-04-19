// Simple API handler to test axios functionality
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
  
  // Parse the URL to determine the endpoint
  const path = req.url.split('?')[0];
  
  console.log(`Request received for path: ${path}, method: ${req.method}`);
  
  try {
    // Handle different paths
    if (path === '/api/health') {
      return res.status(200).json({
        status: 'ok',
        axios: 'installed',
        message: 'Axios is installed and working',
        timestamp: new Date().toISOString()
      });
    } else if (path === '/api/basic-audit') {
      // Extract URL parameter
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
          audit: '/api/basic-audit?url=example.com'
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
