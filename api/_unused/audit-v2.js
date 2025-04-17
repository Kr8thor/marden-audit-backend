// Dedicated audit endpoint that only handles POST requests

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
  
  // If not a POST request, return error
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: 'error',
      message: 'Method not allowed. This endpoint only accepts POST requests.',
    });
  }
  
  try {
    // Extract URL from request body with extra safety checks
    let requestBody = req.body;
    
    // Handle string body (happens in some environments)
    if (typeof requestBody === 'string') {
      try {
        requestBody = JSON.parse(requestBody);
      } catch (e) {
        console.error('Failed to parse request body:', e);
      }
    }
    
    // Extra fallback for Vercel environment
    if (!requestBody && req.rawBody) {
      try {
        requestBody = JSON.parse(req.rawBody.toString());
      } catch (e) {
        console.error('Failed to parse raw body:', e);
      }
    }
    
    const url = requestBody?.url;
    
    console.log('Audit request received for URL:', url);
    
    // Validate URL
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL is required',
      });
    }
    
    // Generate a score that changes slightly for each domain
    let score = 78;
    try {
      const domain = new URL(url).hostname;
      // Generate a score based on domain name
      const sum = domain.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      score = 65 + (sum % 25); // Score between 65-90
    } catch (e) {
      console.error('URL parsing error:', e);
    }
    
    // Generate metrics based on score
    const lcpValue = (3.5 - (score / 50)).toFixed(1);
    const lcpScore = 100 - (Number(lcpValue) * 20);
    
    const clsValue = (0.3 - (score / 1000)).toFixed(2);
    const clsScore = 100 - (Number(clsValue) * 250);
    
    const fidValue = Math.floor(300 - (score * 2));
    const fidScore = 100 - (fidValue / 4);
    
    const issuesFound = Math.floor(25 - (score / 5));
    const opportunities = Math.floor(10 - (score / 10));
    
    // Return mock audit result
    return res.status(200).json({
      url: url,
      score: score,
      issuesFound: issuesFound,
      opportunities: opportunities,
      performanceMetrics: {
        lcp: {
          value: Number(lcpValue),
          unit: 's',
          score: Math.floor(lcpScore),
        },
        cls: {
          value: Number(clsValue),
          score: Math.floor(clsScore),
        },
        fid: {
          value: fidValue,
          unit: 'ms',
          score: Math.floor(fidScore),
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
    });
  } catch (error) {
    console.error('Error handling audit request:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to process audit request',
      error: error.message,
    });
  }
};