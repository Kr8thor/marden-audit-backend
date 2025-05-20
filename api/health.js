// Comprehensive health check endpoint
const redis = require('./lib/redis.optimized.js');

module.exports = async (req, res) => {
  try {
    // Check Redis connectivity
    const redisHealth = await redis.checkHealth();
    const redisStats = redis.getStats();
    
    // Get memory usage
    const memUsage = process.memoryUsage();
    
    // Get environment and concurrency info
    const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || '3', 10);
    
    // Format response
    res.status(200).json({
      status: "ok",
      version: "v2.1",
      message: "Marden SEO Audit API is operational",
      components: {
        api: {
          status: "ok"
        },
        redis: {
          status: redisHealth ? "ok" : "error",
          message: redisHealth ? "Connected" : "Not connected",
          stats: redisStats
        }
      },
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        usage: `${(memUsage.heapUsed / memUsage.heapTotal * 100).toFixed(1)}%`
      },
      concurrency: {
        activeRequests: global.activeRequests || 0,
        pendingRequests: global.requestQueue ? global.requestQueue.length : 0,
        limit: MAX_CONCURRENCY
      },
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: "error",
      message: "Health check failed",
      error: process.env.NODE_ENV === 'production' ? 'Internal error' : error.message,
      timestamp: new Date().toISOString()
    });
  }
};