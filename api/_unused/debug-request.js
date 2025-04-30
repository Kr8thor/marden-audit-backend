// Simple endpoint to debug incoming requests
module.exports = (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Return full request details
  return res.status(200).json({
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    body: req.body, // This will show us what Vercel is actually providing
    bodyType: typeof req.body,
    hasBody: !!req.body,
    rawBody: req.rawBody
  });
};