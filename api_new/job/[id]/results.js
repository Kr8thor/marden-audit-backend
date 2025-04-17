// Get job results endpoint
module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed' 
    });
  }

  try {
    // Get job ID from URL
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Job ID is required' 
      });
    }

    // Generate a random score between 60 and 95
    const score = Math.floor(Math.random() * 35) + 60;
    
    // Return mock audit results
    return res.status(200).json({
      status: 'ok',
      jobId: id,
      results: {
        url: 'https://example.com',
        score: score,
        issuesFound: 12,
        opportunities: 5,
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
        ],
      }
    });
  } catch (error) {
    console.error(`Error getting job results:`, error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get job results',
      error: error.message
    });
  }
};