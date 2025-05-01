// API entry point - delegates to main.js
try {
  // Load environment variables if needed
  if (process.env.NODE_ENV !== 'production') {
    try {
      require('dotenv').config();
    } catch (e) {
      console.warn('Dotenv not available, skipping');
    }
  }
  
  // Export main API handler
  module.exports = require('./main.js');
  console.log('API initialized successfully');
} catch (error) {
  console.error('Failed to initialize API:', error);
  
  // Fallback handler in case of initialization failure
  module.exports = async (req, res) => {
    console.error('Using fallback handler due to initialization failure');
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin, Cache-Control');

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Return error status
    return res.status(500).json({
      status: 'error',
      message: 'API initialization failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  };
}