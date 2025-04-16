// Simple status endpoint to verify API functionality
export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}
