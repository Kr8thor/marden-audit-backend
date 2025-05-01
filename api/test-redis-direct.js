// Test Redis connection directly
const { Redis } = require('@upstash/redis');

async function testRedis() {
  try {
    console.log('Testing Redis connection directly...');
    
    // Create Redis client directly with credentials
    const redis = new Redis({
      url: 'https://smiling-shrimp-21387.upstash.io',
      token: 'AVOLAAIjcDFmNzVjNDVjZGM3MGY0NDczODEyMTA0NTAyOGNkMTc5OXAxMA'
    });
    
    // Set a test value
    const testKey = 'test:connection:' + Date.now();
    await redis.set(testKey, 'Hello from test script!', { ex: 60 });
    console.log(`Successfully set key ${testKey}`);
    
    // Get the test value
    const value = await redis.get(testKey);
    console.log(`Retrieved value: ${value}`);
    
    // Delete the test value
    const deleteResult = await redis.del(testKey);
    console.log(`Deleted key: ${deleteResult === 1 ? 'success' : 'not found'}`);
    
    console.log('Redis test completed successfully!');
    return true;
  } catch (error) {
    console.error('Redis test failed:', error);
    return false;
  }
}

// Run the test and return status code based on result
testRedis()
  .then(success => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });