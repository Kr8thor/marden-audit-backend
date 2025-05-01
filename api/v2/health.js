// Health check endpoint for API v2
const { redis } = require('../lib/redis.js');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin, Cache-Control');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'error',
      message: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    // Check Redis connection
    let redisStatus = 'ok';
    let redisError = null;
    
    try {
      // Test Redis connection by setting and getting a value
      const testKey = 'health:check:' + Date.now();
      await redis.set(testKey, 'test', { ex: 10 });
      const testValue = await redis.get(testKey);
      
      if (testValue !== 'test') {
        redisStatus = 'error';
        redisError = 'Redis read/write test failed';
      }
    } catch (error) {
      redisStatus = 'error';
      redisError = error.message;
    }
    
    return res.status(200).json({
      status: 'ok',
      version: 'v2',
      message: 'Marden SEO Audit API is operational',
      components: {
        redis: {
          status: redisStatus,
          error: redisError
        },
        api: {
          status: 'ok'
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};