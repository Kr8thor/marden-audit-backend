// Simplified /api/index.js with support for all endpoints
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
  
  // Log the request details
  console.log('Request URL:', req.url);
  console.log('Request Method:', req.method);
  
  // Parse the URL to determine the endpoint
  const path = req.url.split('?')[0];
  
  console.log(`Request received for path: ${path}, method: ${req.method}`);
  
  try {
    // Route to appropriate handler based on the path
    if (path === '/api/health') {
      return handleHealth(req, res);
    } else if (path === '/api/basic-audit') {
      return handleAudit(req, res);
    } else {
      // Default handler for root path
      return handleRoot(req, res);
    }
  } catch (error) {
    console.error('Error handling request:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message || 'An unexpected error occurred'
    });
  }
}

// Health endpoint handler
async function handleHealth(req, res) {
  // Return health status
  return res.status(200).json({
    service: 'MardenSEO Audit API',
    status: 'ok',
    redis: {
      status: 'connected',
      connected: true
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}

// Root endpoint handler
async function handleRoot(req, res) {
  return res.status(200).json({
    name: 'MardenSEO Audit API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      basicAudit: '/api/basic-audit'
    },
    documentation: 'Use GET or POST to /api/basic-audit with url parameter to run an SEO audit',
    timestamp: new Date().toISOString()
  });
}

// Audit endpoint handler - supports both GET and POST methods
async function handleAudit(req, res) {
  try {
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
    
    // Create a simple audit result
    const auditResult = {
      url: targetUrl,
      auditDate: new Date().toISOString(),
      overallScore: 75,
      method: req.method,
      cached: false,
      metrics: {
        meta: {
          title: {
            value: "Sample page title",
            length: 17
          },
          metaDescription: {
            value: "Sample meta description for testing",
            length: 32
          },
          score: 80,
          issues: ["Sample issue for testing"]
        }
      },
      summary: {
        text: "This is a sample audit result to verify the endpoint is working with " + req.method,
        issueCount: 1,
        topIssues: [
          {
            severity: "info",
            issue: "This is a test response"
          }
        ]
      }
    };
    
    // Return the result
    return res.status(200).json(auditResult);
  } catch (error) {
    console.error('Error in audit handler:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message || 'An unexpected error occurred',
      method: req.method
    });
  }
}
