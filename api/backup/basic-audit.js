// Extremely simple audit API that only uses query parameters
module.exports = (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Set content type
  res.setHeader('Content-Type', 'application/json');
  
  // Get URL from query parameter
  const url = req.query.url || 'example.com';
  
  // Generate score based on URL
  let score = 78;
  try {
    const domain = url.replace('https://', '').replace('http://', '').split('/')[0];
    const sum = [...domain].reduce((acc, char) => acc + char.charCodeAt(0), 0);
    score = 65 + (sum % 25); // Score between 65-90
  } catch (e) {
    console.error('Error calculating score:', e);
  }
  
  // Generate metrics based on score
  const lcpValue = Number((3.5 - (score / 50)).toFixed(1));
  const clsValue = Number((0.3 - (score / 1000)).toFixed(2));
  const fidValue = Math.floor(300 - (score * 2));
  
  // Return the audit result
  return res.status(200).json({
    url: url,
    score: score,
    issuesFound: Math.floor(25 - (score / 5)),
    opportunities: Math.floor(10 - (score / 10)),
    performanceMetrics: {
      lcp: {
        value: lcpValue,
        unit: 's',
        score: Math.floor(100 - (lcpValue * 20)),
      },
      cls: {
        value: clsValue,
        score: Math.floor(100 - (clsValue * 250)),
      },
      fid: {
        value: fidValue,
        unit: 'ms',
        score: Math.floor(100 - (fidValue / 4)),
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
  });
};