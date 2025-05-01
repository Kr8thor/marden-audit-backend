// Main API router
const { Redis } = require('@upstash/redis');
const { nanoid } = require('nanoid');

// Import API routes
const auditRouter = require('./audit/index.js');
const healthCheck = require('./health.js');
const seoAnalyze = require('./seo-analyze.js');
const worker = require('./worker.js');

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Main API handler with versioned routing
 */
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin, Cache-Control');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Parse the URL path
  const path = req.url.split('?')[0];
  console.log(`Request received for path: ${path}, method: ${req.method}`);
  
  try {
    // API version 1 routes
    if (path.startsWith('/api/v1/')) {
      const subPath = path.replace('/api/v1/', '');
      
      // Health check
      if (subPath === 'health' || subPath === 'health/') {
        return healthCheck(req, res);
      }
      
      // SEO analysis
      if (subPath === 'seo-analyze' || subPath === 'seo-analyze/') {
        return seoAnalyze(req, res);
      }
      
      // All other v1 endpoints
      return res.status(404).json({
        status: 'error',
        message: `API endpoint ${path} not found`,
        version: 'v1'
      });
    }
    
    // API version 2 routes (default version)
    if (path.startsWith('/api/v2/') || path.startsWith('/api/')) {
      // Remove version prefix if present
      const subPath = path.replace(/^\/api\/(v2\/)?/, '');
      
      // Audit endpoints
      if (subPath.startsWith('audit/')) {
        return auditRouter(req, res);
      }
      
      // Health check
      if (subPath === 'health' || subPath === 'health/') {
        return healthCheck(req, res);
      }
      
      // Job status and results
      if (subPath.startsWith('job/')) {
        // Dynamic route handling for job endpoints
        const parts = subPath.split('/').filter(Boolean);
        
        // If only have "job/{id}"
        if (parts.length === 2) {
          const jobId = parts[1];
          req.query = { ...req.query, id: jobId };
          
          // Load the appropriate handler dynamically
          const handler = require('./job/[id].js').default;
          return handler(req, res);
        }
        
        // If have "job/{id}/results"
        if (parts.length === 3 && parts[2] === 'results') {
          const jobId = parts[1];
          req.query = { ...req.query, id: jobId };
          
          // Load the appropriate handler dynamically
          const handler = require('./job/[id]/results.js').default;
          return handler(req, res);
        }
      }
      
      // SEO analysis v2 (enhanced)
      if (subPath === 'seo-analyze' || subPath === 'seo-analyze/') {
        return seoAnalyze(req, res);
      }
      
      // All other v2 endpoints
      return res.status(404).json({
        status: 'error',
        message: `API endpoint ${path} not found`,
        version: 'v2'
      });
    }
    
    // Root endpoint - API info
    if (path === '/api' || path === '/api/') {
      return res.status(200).json({
        status: 'ok',
        name: 'Marden SEO Audit API',
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString(),
        endpoints: {
          v2: {
            audit: {
              page: '/api/v2/audit/page',
              site: '/api/v2/audit/site'
            },
            job: {
              status: '/api/v2/job/{jobId}',
              results: '/api/v2/job/{jobId}/results'
            },
            health: '/api/v2/health'
          }
        }
      });
    }
    
    // Handle unmatched routes
    return res.status(404).json({
      status: 'error',
      message: `Path ${path} not found`
    });
  } catch (error) {
    console.error('Error handling request:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};