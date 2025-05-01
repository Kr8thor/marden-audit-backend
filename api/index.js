// API entry point - delegates to main.js
try {
  // Load environment variables if needed
  if (process.env.NODE_ENV !== 'production') {
    try {
      require('dotenv').config();
    } catch (e) {
      console.warn('Dotenv not available, skipping');
    }
  }
  
  // Export the main handler directly
  const axios = require('axios');
  const cheerio = require('cheerio');
  const url = require('url');
  const { processBatch } = require('./worker.js'); // Import the worker for job processing

  // Import API version handlers
  const v1Handler = require('./old-index.js');  // Legacy v1 API
  let v2Handler;

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
    setTimeout(processJobs, 10000);
  }

  // Start job processing in the background (in production)
  if (process.env.NODE_ENV === 'production') {
    setTimeout(processJobs, 5000); // Start after 5 seconds
  }

  // Export the main API handler
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
        console.log("Routing to v2 API handler:", path);
        return await v2Handler(req, res);
      } else if (path === '/api/health' || 
                path === '/api/seo-analyze' || 
                path === '/api/real-seo-audit' || 
                path === '/api/basic-audit' || 
                path === '/api' || 
                path === '/api/' ||
                path === '/') {
        // Legacy v1 API endpoints remain at their original paths
        console.log("Routing to v1 API handler:", path);
        return await v1Handler(req, res);
      } else {
        // API router - redirect to v2 by default with message
        console.log("Redirecting to v2 API:", path);
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
  
  console.log('API initialized successfully');
} catch (error) {
  console.error('Failed to initialize API:', error);
  
  // Fallback handler in case of initialization failure
  module.exports = async (req, res) => {
    console.error('Using fallback handler due to initialization failure');
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin, Cache-Control');

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Return error status
    return res.status(500).json({
      status: 'error',
      message: 'API initialization failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  };
}