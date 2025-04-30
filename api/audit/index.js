// Generic audit endpoint for Vercel serverless function
// This is a simplified version to get things working

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed' 
    });
  }

  try {
    const { url } = req.body;
    
    // Validate URL
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL is required',
      });
    }
    
    // For demo/testing purposes we're returning a mock result immediately
    const mockAuditResult = {
      url: url,
      score: 78,
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
    };
    
    // Return success response with mock data for now
    return res.status(200).json(mockAuditResult);
  } catch (error) {
    // Handle errors
    console.error('Error creating audit job:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create audit job',
      error: error.message,
    });
  }
};