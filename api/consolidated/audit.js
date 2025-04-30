// Consolidated audit endpoint
const cheerio = require('cheerio');
const axios = require('axios');

// Helper functions
function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  return false;
}

// Generate a simple job ID
function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

// Main handler
module.exports = async (req, res) => {
  // Handle CORS
  if (handleCors(req, res)) return;
  
  // Check HTTP method
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: 'error',
      message: 'Method not allowed'
    });
  }
  
  try {
    // Extract URL and audit type from request
    const { url, type = 'site' } = req.body;
    const auditType = req.query.type || type; // Can be 'site' or 'page'
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL is required'
      });
    }
    
    // Ensure URL has protocol
    const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
    
    // Create job ID
    const jobId = generateJobId();
    
    // For demo/testing, we'll return a job ID immediately
    // In a real implementation, this would queue the job in Redis
    return res.status(200).json({
      status: 'ok',
      message: `${auditType === 'page' ? 'Page' : 'Site'} audit job created`,
      jobId: jobId,
      url: cleanUrl,
      estimatedTime: auditType === 'page' ? '15-30 seconds' : '1-3 minutes'
    });
  } catch (error) {
    console.error('Error creating audit job:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create audit job',
      error: error.message
    });
  }
};
