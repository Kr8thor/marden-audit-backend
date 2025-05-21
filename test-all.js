// Comprehensive test script for Marden SEO Audit Tool
require('dotenv').config();
const http = require('http');
const https = require('https');
const redis = require('./api/lib/redis.optimized');

// Set colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// Record test result
function recordTest(name, success, details = {}) {
  results.total++;
  if (success) {
    results.passed++;
    console.log(`${colors.green}✓ ${name}${colors.reset}`);
  } else {
    results.failed++;
    console.log(`${colors.red}✗ ${name}${colors.reset}`);
    if (details.error) {
      console.log(`  ${colors.red}Error: ${details.error}${colors.reset}`);
    }
  }
  
  results.tests.push({
    name,
    success,
    ...details,
    timestamp: new Date().toISOString()
  });
}

// HTTP request helper with timeout
function httpRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    // Determine protocol based on URL
    const protocol = options.url.startsWith('https') ? https : http;
    const url = new URL(options.url);
    
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = protocol.request(reqOptions, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        // Try to parse JSON response
        let parsedData;
        try {
          parsedData = JSON.parse(responseData);
        } catch (e) {
          parsedData = responseData;
        }
        
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsedData,
          raw: responseData
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    // Set timeout
    req.setTimeout(options.timeout || 10000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
    
    // Send request body if provided
    if (data) {
      const postData = typeof data === 'string' ? data : JSON.stringify(data);
      req.write(postData);
    }
    
    req.end();
  });
}
// Test Redis functionality
async function testRedis() {
  console.log(`\n${colors.bright}${colors.blue}Testing Redis Connectivity${colors.reset}`);
  
  try {
    // Check Redis configuration
    const configTest = redis.isRedisConfigured;
    recordTest('Redis configuration check', configTest, {
      upstashUrl: process.env.UPSTASH_REDIS_REST_URL ? 'Configured' : 'Missing',
      upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN ? 'Configured' : 'Missing'
    });
    
    if (!configTest) {
      console.log(`${colors.yellow}Skipping Redis tests due to missing configuration${colors.reset}`);
      return false;
    }
    
    // Test PING
    const pingTest = await redis.checkHealth();
    recordTest('Redis health check (PING)', pingTest);
    
    if (!pingTest) {
      console.log(`${colors.yellow}Skipping further Redis tests due to failed health check${colors.reset}`);
      return false;
    }
    
    // Test SET/GET/DELETE
    const testKey = `test-all-${Date.now()}`;
    const testValue = { test: 'Comprehensive test', timestamp: Date.now() };
    
    const setTest = await redis.setCache(testKey, testValue, 60);
    recordTest('Redis SET operation', setTest);
    
    if (setTest) {
      const getTest = await redis.getCache(testKey);
      const getSuccess = getTest && getTest.test === testValue.test;
      recordTest('Redis GET operation', getSuccess, { 
        received: getTest,
        expected: testValue
      });
      
      const delTest = await redis.deleteCache(testKey);
      recordTest('Redis DELETE operation', delTest);
      
      // Verify deletion
      const verifyDel = await redis.getCache(testKey);
      recordTest('Redis deletion verification', verifyDel === null);
    }
    
    return pingTest && setTest;
  } catch (error) {
    console.error(`${colors.red}Redis test error:${colors.reset}`, error);
    recordTest('Redis overall test', false, { error: error.message });
    return false;
  }
}

// Test API health endpoint
async function testApiHealth() {
  console.log(`\n${colors.bright}${colors.blue}Testing API Health${colors.reset}`);
  
  try {
    // Determine base URL (local or production)
    const baseUrl = process.env.API_URL || 'http://localhost:3000';
    
    // Test health endpoint
    const response = await httpRequest({
      url: `${baseUrl}/health`,
      method: 'GET',
      timeout: 5000
    });
    
    const success = response.statusCode === 200 && 
                   response.data && 
                   response.data.status === 'ok';
    
    recordTest('API health endpoint', success, {
      statusCode: response.statusCode,
      response: response.data
    });
    
    // Extract Redis status from health check
    if (success && response.data.components && response.data.components.redis) {
      const redisHealthFromApi = response.data.components.redis.status === 'ok';
      recordTest('Redis status via API health check', redisHealthFromApi, {
        redisStatus: response.data.components.redis
      });
    }
    
    return success;
  } catch (error) {
    console.error(`${colors.red}API health test error:${colors.reset}`, error);
    recordTest('API health endpoint', false, { error: error.message });
    return false;
  }
}
// Test SEO analysis functionality
async function testSeoAnalysis() {
  console.log(`\n${colors.bright}${colors.blue}Testing SEO Analysis${colors.reset}`);
  
  try {
    // Determine base URL (local or production)
    const baseUrl = process.env.API_URL || 'http://localhost:3000';
    const testUrl = 'https://example.com'; // Simple test URL
    
    // Test SEO analysis endpoint
    const response = await httpRequest({
      url: `${baseUrl}/seo-analyze`,
      method: 'POST',
      timeout: 15000, // Longer timeout for analysis
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      url: testUrl
    });
    
    const success = response.statusCode === 200 && 
                   response.data && 
                   (response.data.status === 'ok' || response.data.cached === true);
    
    recordTest('SEO analysis endpoint', success, {
      statusCode: response.statusCode,
      responseStatus: response.data?.status,
      cached: response.data?.cached,
      url: testUrl
    });
    
    // Test cached response
    if (success) {
      console.log(`${colors.cyan}Testing cached response (second request)...${colors.reset}`);
      
      const cachedResponse = await httpRequest({
        url: `${baseUrl}/seo-analyze`,
        method: 'POST',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      }, {
        url: testUrl
      });
      
      const cacheSuccess = cachedResponse.statusCode === 200 && 
                           cachedResponse.data && 
                           cachedResponse.data.cached === true;
      
      recordTest('SEO analysis caching', cacheSuccess, {
        statusCode: cachedResponse.statusCode,
        cached: cachedResponse.data?.cached,
        cacheSource: cachedResponse.data?.cacheSource
      });
    }
    
    return success;
  } catch (error) {
    console.error(`${colors.red}SEO analysis test error:${colors.reset}`, error);
    recordTest('SEO analysis endpoint', false, { error: error.message });
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log(`${colors.bright}${colors.magenta}=== Marden SEO Audit Tool Comprehensive Test ===\n${colors.reset}`);
  console.log(`Testing environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  // Run tests in sequence
  await testRedis();
  await testApiHealth();
  await testSeoAnalysis();
  
  // Display test summary
  console.log(`\n${colors.bright}${colors.magenta}=== Test Results Summary ===\n${colors.reset}`);
  console.log(`Total tests: ${results.total}`);
  console.log(`Passed: ${colors.green}${results.passed}${colors.reset}`);
  console.log(`Failed: ${results.failed > 0 ? colors.red : colors.green}${results.failed}${colors.reset}`);
  console.log(`Success rate: ${Math.round(results.passed / results.total * 100)}%`);
  
  // Overall result
  if (results.failed === 0) {
    console.log(`\n${colors.green}${colors.bright}✅ All tests passed! The system is functioning correctly.${colors.reset}`);
    return true;
  } else {
    console.log(`\n${colors.red}${colors.bright}❌ Some tests failed. Please check the detailed results above.${colors.reset}`);
    return false;
  }
}

// Run tests and exit with appropriate code
runAllTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(`${colors.red}${colors.bright}Unhandled error in test suite:${colors.reset}`, error);
    process.exit(1);
  });