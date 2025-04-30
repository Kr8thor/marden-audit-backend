// Health check endpoint
module.exports = function handler(req, res) {
  res.status(200).json({ 
    status: 'ok',
    service: 'Marden SEO Audit API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
}
