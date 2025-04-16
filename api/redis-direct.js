// Direct Redis connection test
import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  try {
    // Get environment variables directly
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    // Check if Redis configuration exists
    if (!redisUrl || !redisToken) {
      return res.status(500).json({
        status: 'error',
        message: 'Redis configuration is missing',
        timestamp: new Date().toISOString(),
        redisConfig: {
          url: redisUrl ? 'Configured' : 'Missing',
          token: redisToken ? 'Configured' : 'Missing'
        }
      });
    }
    
    // Initialize Redis client directly
    const redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    
    // Test the connection with a simple operation
    const testKey = 'direct:test:' + Date.now();
    const testValue = { timestamp: Date.now() };
    
    await redis.set(testKey, testValue);
    const result = await redis.get(testKey);
    await redis.del(testKey);
    
    res.status(200).json({
      status: 'ok',
      message: 'Redis connection successful',
      timestamp: new Date().toISOString(),
      testResult: result ? 'Success' : 'Failed',
      redisConfig: {
        url: 'Configured properly',
        token: 'Configured properly'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Redis connection test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
