// Simple status endpoint to verify API functionality
module.exports = (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
};
