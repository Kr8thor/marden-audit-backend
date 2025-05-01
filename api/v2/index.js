// API v2 router
const url = require('url');

// Import route handlers
let healthHandler;
let pageAuditHandler;
let siteAuditHandler;
let seoAnalyzeHandler;

try {
  healthHandler = require('./health.js');
  console.log("Loaded health handler");
} catch (error) {
  console.error("Failed to load health handler:", error);
  healthHandler = (req, res) => {
    return res.status(500).json({
      status: 'error',
      message: 'Health handler failed to load',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  };
}

try {
  pageAuditHandler = require('./audit/page.js');
  console.log("Loaded page audit handler");
} catch (error) {
  console.error("Failed to load page audit handler:", error);
  pageAuditHandler = (req, res) => {
    return res.status(500).json({
      status: 'error',
      message: 'Page audit handler failed to load',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  };
}

try {
  siteAuditHandler = require('./audit/site.js');
  console.log("Loaded site audit handler");
} catch (error) {
  console.error("Failed to load site audit handler:", error);
  siteAuditHandler = (req, res) => {
    return res.status(500).json({
      status: 'error',
      message: 'Site audit handler failed to load',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  };
}

try {
  seoAnalyzeHandler = require('./seo-analyze.js');
  console.log("Loaded SEO analyze handler");
} catch (error) {
  console.error("Failed to load SEO analyze handler:", error);
  seoAnalyzeHandler = (req, res) => {
    return res.status(500).json({
      status: 'error',
      message: 'SEO analyze handler failed to load',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  };
}

/**
 * Route request to appropriate handler based on path
 */
async function routeRequest(req, res) {
  // Parse the URL and extract path
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  console.log(`[API v2] Request received for path: ${path}, method: ${req.method}`);
  
  // Get the query parameters
  req.query = parsedUrl.query;
  
  // Extract jobId from path if present
  if (path.includes('/job/')) {
    const matches = path.match(/\/job\/([^\/]+)(?:\/(.+))?/);
    if (matches) {
      req.query.jobId = matches[1];
      
      // Check if we have a subresource (like '/results')
      if (matches[2] === 'results') {
        try {
          // Import the results handler dynamically
          const resultsHandler = require('./job/[jobId]/results.js');
          return await resultsHandler(req, res);
        } catch (error) {
          console.error('Error handling job results request:', error);
          return res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Handle job status
      try {
        const jobHandler = require('./job/[jobId].js');
        return await jobHandler(req, res);
      } catch (error) {
        console.error('Error handling job status request:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Internal server error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }
  
  // Route based on path
  if (path === '/v2/health' || path === '/v2/health/') {
    return await healthHandler(req, res);
  } else if (path === '/v2/audit/page' || path === '/v2/audit/page/') {
    return await pageAuditHandler(req, res);
  } else if (path === '/v2/audit/site' || path === '/v2/audit/site/') {
    return await siteAuditHandler(req, res);
  } else if (path === '/v2/seo-analyze' || path === '/v2/seo-analyze/') {
    return await seoAnalyzeHandler(req, res);
  }
  
  // Return 404 for unmatched routes
  return res.status(404).json({
    status: 'error',
    message: `Endpoint not found: ${path}`,
    version: 'v2',
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      '/v2/health',
      '/v2/audit/page',
      '/v2/audit/site',
      '/v2/job/:jobId',
      '/v2/job/:jobId/results',
      '/v2/seo-analyze'
    ]
  });
}

module.exports = routeRequest;