// Consolidated API handler for all endpoints
// This single file handles all routes to stay within Vercel's function limit

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
  
  // Get the path from query parameters
  const path = req.query.path || '';
  
  // Route based on path
  switch (path) {
    case 'health':
      return handleHealth(req, res);
    case 'audit':
    case 'audit/site':
      return handleAuditSite(req, res);
    case 'audit/page':
      return handleAuditPage(req, res);
    case 'job':
      return handleJobStatus(req, res);
    case 'job/results':
      return handleJobResults(req, res);
    case 'worker':
      return handleWorker(req, res);
    default:
      return handleIndex(req, res);
  }
};

// Handler for /api
function handleIndex(req, res) {
  return res.status(200).json({
    status: 'ok',
    message: 'Marden SEO Audit API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}

// Handler for /api/health
function handleHealth(req, res) {
  return res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    message: 'System is healthy'
  });
}

// Handler for /api/audit/site
function handleAuditSite(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed' 
    });
  }

  try {
    // Extract URL from request body
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL is required'
      });
    }
    
    // Ensure URL has protocol
    const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
    
    // Create a job ID
    const jobId = generateJobId();
    
    // Mock response for site audit
    return res.status(200).json({
      status: 'success',
      message: `Site audit job created for ${cleanUrl}`,
      jobId: jobId,
      url: cleanUrl,
      estimatedTime: '30-60 seconds'
    });
  } catch (error) {
    console.error('Error creating audit job:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create audit job',
      error: error.message
    });
  }
}

// Handler for /api/audit/page
function handleAuditPage(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed' 
    });
  }

  try {
    // Extract URL from request body
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL is required'
      });
    }
    
    // Ensure URL has protocol
    const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
    
    // Create a job ID
    const jobId = generateJobId();
    
    // Mock response for page audit
    return res.status(200).json({
      status: 'success',
      message: `Page audit job created for ${cleanUrl}`,
      jobId: jobId,
      url: cleanUrl,
      estimatedTime: '15-30 seconds'
    });
  } catch (error) {
    console.error('Error creating page audit job:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create page audit job',
      error: error.message
    });
  }
}

// Handler for /api/job/:id
function handleJobStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed' 
    });
  }

  try {
    // Get job ID from query
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Job ID is required'
      });
    }
    
    // Mock response for job status
    return res.status(200).json({
      status: 'ok',
      job: {
        id: id,
        status: 'completed',
        progress: 100,
        created: Date.now() - 60000,
        updated: Date.now(),
        hasResults: true,
        type: 'site_audit',
        params: {
          url: 'https://example.com',
          options: {}
        }
      }
    });
  } catch (error) {
    console.error('Error getting job status:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get job status',
      error: error.message
    });
  }
}

// Handler for /api/job/:id/results
function handleJobResults(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed' 
    });
  }

  try {
    // Get job ID from query
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Job ID is required'
      });
    }
    
    // Generate a mock score based on the job ID
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const score = 65 + (hash % 35); // Score between 65-99
    
    // Mock response for job results
    return res.status(200).json({
      status: 'ok',
      jobId: id,
      completed: Date.now(),
      results: {
        url: 'https://example.com',
        score: score,
        issuesFound: Math.floor(25 - (score / 5)),
        opportunities: Math.floor(10 - (score / 10)),
        performanceMetrics: {
          lcp: {
            value: 2.4,
            unit: 's',
            score: 85,
          },
          cls: {
            value: 0.15,
            score: 75,
          },
          fid: {
            value: 180,
            unit: 'ms',
            score: 70,
          },
        },
        topIssues: [
          {
            severity: 'critical',
            description: 'Missing meta descriptions on 3 pages',
          },
          {
            severity: 'warning',
            description: 'Images without alt text',
          },
          {
            severity: 'info',
            description: 'Consider adding structured data',
          },
        ]
      }
    });
  } catch (error) {
    console.error('Error getting job results:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get job results',
      error: error.message
    });
  }
}

// Handler for /api/worker
function handleWorker(req, res) {
  console.log('Worker executed at:', new Date().toISOString());
  
  // Mock response for worker
  return res.status(200).json({
    status: 'success',
    message: 'Worker process executed successfully',
    timestamp: new Date().toISOString(),
    processed: 0,
    remaining: 0
  });
}