// Health check endpoint
const { redis } = require('./lib/redis.js');

module.exports = async function handler(req, res) {
  // Get application version and environment
  const version = process.env.npm_package_version || '1.0.0';
  const environment = process.env.NODE_ENV || 'production';

  try {
    // Check Redis connection
    let redisStatus = 'available';
    try {
      if (redis) {
        // Try to ping Redis
        await redis.set('health-check', 'ok', { ex: 5 });
        const value = await redis.get('health-check');
        
        if (value !== 'ok') {
          redisStatus = 'error';
        }
      } else {
        redisStatus = 'unavailable';
      }
    } catch (redisError) {
      console.error('Redis health check failed:', redisError);
      redisStatus = 'error';
    }

    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version,
      environment,
      services: {
        redis: redisStatus
      },
      message: 'Health check passed'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      version,
      environment,
      message: 'Health check failed',
      error: error.message
    });
  }
};