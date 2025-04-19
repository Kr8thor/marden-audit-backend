// Consolidated main index and health check endpoint
const os = require('os');

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

// Main handler
module.exports = async (req, res) => {
  // Handle CORS
  if (handleCors(req, res)) return;
  
  // Check if this is a health check
  const isHealthCheck = req.url.includes('/health');
  
  if (isHealthCheck) {
    // Return detailed health information
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        freemem: os.freemem(),
        totalmem: os.totalmem(),
        loadavg: os.loadavg()
      },
      message: 'System is healthy'
    });
  }
  
  // Default index response
  return res.status(200).json({
    status: 'ok',
    message: 'Marden SEO Audit API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
};
