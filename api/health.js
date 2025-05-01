// Basic health check endpoint
module.exports = (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'API is operational',
    version: 'v2',
    timestamp: new Date().toISOString()
  });
};