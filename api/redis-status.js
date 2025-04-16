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
    // Check Redis connection by testing basic operations
    const testKey = 'redis:test:connection';
    const testValue = {
      timestamp: Date.now(),
      message: 'Redis connection test'
    };
    
    // Try to write to Redis
    await kvStore.set(testKey, testValue);
    
    // Try to read from Redis
    const retrievedValue = await kvStore.get(testKey);
    
    // Try to delete from Redis
    await kvStore.delete(testKey);
    
    // Get queue statistics
    const queueLength = await kvStore.getListLength(config.keys.queueKey);
    const processingLength = await kvStore.getListLength(config.keys.processingQueueKey);
    
    // Return success with Redis information
    res.status(200).json({
      status: 'ok',
      message: 'Redis connection is working',
      timestamp: new Date().toISOString(),
      redisConfig: {
        url: config.redis.url ? 'Configured' : 'Missing',
        token: config.redis.token ? 'Configured' : 'Missing'
      },
      testResults: {
        write: !!retrievedValue,
        read: !!retrievedValue,
        delete: true
      },
      queueStats: {
        waiting: queueLength,
        processing: processingLength
      }
    });
  } catch (error) {
    logger.error('Redis connection check failed:', error);
    
    // Return error response
    res.status(500).json({
      status: 'error',
      message: 'Redis connection check failed',
      error: error.message,
      timestamp: new Date().toISOString(),
      redisConfig: {
        url: config.redis.url ? 'Configured' : 'Missing',
        token: config.redis.token ? 'Configured' : 'Missing'
      }
    });
  }
}
