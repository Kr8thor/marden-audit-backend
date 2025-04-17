// Dedicated SEO Audit API Endpoint
// This is a simplified, reliable endpoint that works with both GET and POST

module.exports = (req, res) => {
  // Set CORS headers to allow requests from anywhere
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle OPTIONS requests (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Log the entire request for debugging
  console.log('Request method:', req.method);
  console.log('Request query:', JSON.stringify(req.query));
  
  try {
    console.log('Request body:', req.body);
  } catch (e) {
    console.log('Error logging body:', e.message);
  }
  
  // Get URL from query parameters or body
  let url = '';
  
  // Check query parameters (for GET requests)
  if (req.query && req.query.url) {
    url = req.query.url;
  } 
  // Check body (for POST requests)
  else if (req.body && req.body.url) {
    url = req.body.url;
  }
  // Try to parse body if it's a string
  else if (req.body && typeof req.body === 'string') {
    try {
      const parsedBody = JSON.parse(req.body);
      if (parsedBody.url) {
        url = parsedBody.url;
      }
    } catch (e) {
      console.log('Could not parse body as JSON');
    }
  }
  
  console.log('URL extracted:', url);
  
  // If no URL was found, use a default
  if (!url) {
    url = 'example.com';
  }
  
  // Normalize URL (add https if missing)
  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }
  
  // Generate unique score based on domain
  let score = 78;
  try {
    const domain = new URL(url).hostname;
    let sum = 0;
    for (let i = 0; i < domain.length; i++) {
      sum += domain.charCodeAt(i);
    }
    score = 60 + (sum % 30); // Score between 60-90
  } catch (e) {
    console.log('URL parsing error:', e.message);
  }
  
  // Calculate other metrics based on score
  const lcpValue = parseFloat((3.5 - (score / 50)).toFixed(1));
  const clsValue = parseFloat((0.3 - (score / 1000)).toFixed(2));
  const fidValue = Math.floor(300 - (score * 2));
  
  const lcpScore = Math.floor(100 - (lcpValue * 20));
  const clsScore = Math.floor(100 - (clsValue * 250));
  const fidScore = Math.floor(100 - (fidValue / 4));
  
  const issuesFound = Math.floor(25 - (score / 5));
  const opportunities = Math.floor(10 - (score / 10));
  
  // Generate mock audit result
  const result = {
    url: url,
    score: score,
    issuesFound: issuesFound,
    opportunities: opportunities,
    performanceMetrics: {
      lcp: {
        value: lcpValue,
        unit: 's',
        score: lcpScore,
      },
      cls: {
        value: clsValue,
        score: clsScore,
      },
      fid: {
        value: fidValue,
        unit: 'ms',
        score: fidScore,
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
  
  // Set content type and return the result
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json(result);
};