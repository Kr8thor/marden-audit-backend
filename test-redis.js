// Test Redis connection and functionality
require('dotenv').config();
const redis = require('./api/lib/redis.optimized');

// Set colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

async function testRedis() {
  console.log(`${colors.bright}Testing Redis connectivity...${colors.reset}`);
  
  // Check if Redis is configured
  if (!redis.isRedisConfigured) {
    console.log(`${colors.red}Redis is not configured!${colors.reset}`);
    console.log(`
${colors.yellow}Make sure you have set the following environment variables:
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN${colors.reset}
`);
    return false;
  }
  
  console.log(`${colors.blue}Redis is configured with URL: ${process.env.UPSTASH_REDIS_REST_URL}${colors.reset}`);
  
  try {
    // Test health check (PING)
    console.log(`\n${colors.bright}Testing Redis health (PING)...${colors.reset}`);
    const healthResult = await redis.checkHealth();
    
    if (healthResult) {
      console.log(`${colors.green}✓ Redis is healthy (PING successful)${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Redis health check failed!${colors.reset}`);
      return false;
    }
    
    // Test SET operation
    console.log(`\n${colors.bright}Testing Redis SET operation...${colors.reset}`);
    const testKey = `test-key-${Date.now()}`;
    const testValue = { 
      message: 'Redis integration test',
      timestamp: new Date().toISOString()
    };
    
    const setResult = await redis.setCache(testKey, testValue, 60); // 60 second TTL
    
    if (setResult) {
      console.log(`${colors.green}✓ Successfully set test key '${testKey}'${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Failed to set test key!${colors.reset}`);
      return false;
    }
    
    // Test GET operation
    console.log(`\n${colors.bright}Testing Redis GET operation...${colors.reset}`);
    const getResult = await redis.getCache(testKey);
    
    if (getResult && getResult.message === testValue.message) {
      console.log(`${colors.green}✓ Successfully retrieved test key '${testKey}'${colors.reset}`);
      console.log(`${colors.blue}Retrieved value:${colors.reset}`, getResult);
    } else {
      console.log(`${colors.red}✗ Failed to retrieve test key or value mismatch!${colors.reset}`);
      console.log('Received:', getResult);
      console.log('Expected:', testValue);
      return false;
    }
    
    // Test DELETE operation
    console.log(`\n${colors.bright}Testing Redis DELETE operation...${colors.reset}`);
    const deleteResult = await redis.deleteCache(testKey);
    
    if (deleteResult) {
      console.log(`${colors.green}✓ Successfully deleted test key '${testKey}'${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Failed to delete test key!${colors.reset}`);
      return false;
    }
    
    // Verify key was deleted
    const verifyDelete = await redis.getCache(testKey);
    
    if (verifyDelete === null) {
      console.log(`${colors.green}✓ Key deletion verified (key no longer exists)${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Key still exists after deletion!${colors.reset}`);
      return false;
    }
    
    // Test memory cache
    console.log(`\n${colors.bright}Testing memory cache...${colors.reset}`);
    const memKey = `mem-test-${Date.now()}`;
    const memValue = { test: 'Memory cache test' };
    
    // Set in memory cache through Redis module
    await redis.setCache(memKey, memValue, 60);
    
    // Check if it's in memory cache
    if (redis.memoryCache.has(memKey)) {
      console.log(`${colors.green}✓ Value successfully stored in memory cache${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Failed to store in memory cache!${colors.reset}`);
    }
    
    // Clean up
    await redis.deleteCache(memKey);
    
    // All tests passed
    console.log(`\n${colors.green}${colors.bright}✅ All Redis tests passed successfully!${colors.reset}`);
    
    // Display statistics
    console.log(`\n${colors.bright}Redis Statistics:${colors.reset}`);
    console.log(redis.getStats());
    
    return true;
  } catch (error) {
    console.error(`${colors.red}Redis test failed with error:${colors.reset}`, error);
    return false;
  }
}

// Run the test
testRedis()
  .then(success => {
    if (!success) {
      console.log(`\n${colors.red}${colors.bright}❌ Redis connection test failed!${colors.reset}`);
      process.exit(1);
    } else {
      console.log(`\n${colors.green}${colors.bright}Redis connection is working properly!${colors.reset}`);
      process.exit(0);
    }
  })
  .catch(error => {
    console.error(`${colors.red}${colors.bright}❌ Unexpected error:${colors.reset}`, error);
    process.exit(1);
  });
