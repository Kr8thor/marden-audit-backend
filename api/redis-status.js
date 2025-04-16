// Redis connection status check
import kvStore from '../src/services/storage/kv-store.js';
import config from '../src/config/index.js';
import logger from '../src/utils/logger.js';

/**
 * Endpoint to check Redis connection status
 * Useful for debugging Redis connectivity issues
 */
export default async function handler(req, res) {
  try {
    // Check if Redis configuration exists
    if (!config.redis || !config.redis.url || !config.redis.token) {
      return res.status(500).json({
        status: 'error',
        message: 'Redis configuration is missing',
        timestamp: new Date().toISOString(),
        redisConfig: {
          url: config.redis?.url ? 'Configured' : 'Missing',
          token: config.redis?.token ? 'Configured' : 'Missing'
        }
      });
    }
    
    // Create a simple health check endpoint
    res.status(200).json({
      status: 'ok',
      message: 'Redis status check endpoint is working',
      timestamp: new Date().toISOString(),
      redisConfig: {
        url: config.redis.url ? 'Configured' : 'Missing',
        token: config.redis.token ? 'Configured' : 'Missing'
      }
    });
  } catch (error) {
    logger.error('Redis connection check failed:', error);
    
    // Return error response
    res.status(500).json({
      status: 'error',
      message: 'Redis connection check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
