// Main API entry point
const url = require('url');
const { processBatch } = require('./worker.js'); // Import the worker for job processing

// Import API version handlers
// Rename existing index.js to old-index.js and use it as the v1 handler
let v1Handler;
let v2Handler;

try {
  v1Handler = require('./index.js');  // Legacy v1 API
  console.log("Loaded v1 API handler");
} catch (error) {
  console.error("Failed to load v1 API handler:", error);
  v1Handler = (req, res) => {
    return res.status(500).json({
      status: 'error',
      message: 'v1 API handler failed to load',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  };
}

try {
  v2Handler = require('./v2/index.js');  // New v2 API
  console.log("Loaded v2 API handler");
} catch (error) {
  console.error("Failed to load v2 API handler:", error);
  v2Handler = (req, res) => {
    return res.status(500).json({
      status: 'error',
      message: 'v2 API handler failed to load',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  };
}

// Process a batch of jobs in the background
let isProcessing = false;
async function processJobs() {
  if (isProcessing) return;
  
  try {
    isProcessing = true;
    console.log('Starting job processing batch');
    const processed = await processBatch(5);
    console.log(`Processed ${processed} jobs`);
  } catch (error) {
    console.error('Error in job processing batch:', error);
  } finally {
    isProcessing = false;
  }
  
  // Schedule next batch
  setTimeout(processJobs, processed > 0 ? 1000 : 10000);
}

// Main handler
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
    // Route based on API version/path
    if (path.startsWith('/v2/')) {
      // v2 API
      return await v2Handler(req, res);
    } else if (path === '/api/health' || 
              path === '/api/seo-analyze' || 
              path === '/api/real-seo-audit' || 
              path === '/api/basic-audit' || 
              path === '/api' || 
              path === '/api/') {
      // Legacy v1 API endpoints remain at their original paths
      return await v1Handler(req, res);
    } else {
      // API router - redirect to v2 by default with message
      return res.status(307).json({
        status: 'info',
        message: 'Redirecting to API v2',
        version: 'v2',
        redirectTo: '/v2' + path,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error handling request:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Start job processing in the background (only when running in production)
if (process.env.NODE_ENV === 'production') {
  processJobs();
}