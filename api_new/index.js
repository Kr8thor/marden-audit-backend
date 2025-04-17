// Main API entry point
// Handles all requests and routes them to appropriate handlers

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
  
  // For GET requests - return API status
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      message: 'Marden SEO Audit API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }
  
  // For other requests
  return res.status(405).json({
    status: 'error',
    message: 'Method not allowed'
  });
};