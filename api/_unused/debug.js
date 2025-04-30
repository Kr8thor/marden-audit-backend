// Debug endpoint to help diagnose issues with the API

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
  
  // Return detailed information about the request
  return res.status(200).json({
    status: 'ok',
    message: 'Debug endpoint',
    timestamp: new Date().toISOString(),
    requestInfo: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      query: req.query,
    }
  });
};