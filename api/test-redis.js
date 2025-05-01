// Test Redis connection
const { redis } = require('./lib/redis.js');

async function testRedis() {
  try {
    console.log('Testing Redis connection...');
    
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
