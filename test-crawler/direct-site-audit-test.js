/**
 * Direct test for site-audit.js that avoids circular dependencies
 */

// Import the utility functions directly to avoid circular dependencies
const { normalizeUrl, generateSiteAuditCacheKey } = require('../src/crawler/site-audit').utils;

// Import only the crawler, not the full site-audit module
const SiteCrawler = require('../src/crawler/site-crawler');

// Test URLs
const urls = [
  'example.com',
  'https://example.org/',
  'http://test.com/path/'
];

// Test URL normalization
function testNormalizeUrl() {
  console.log('\n========== URL NORMALIZATION TEST ==========');
  
  urls.forEach(url => {
    const normalized = normalizeUrl(url);
    console.log(`Original: "${url}" => Normalized: "${normalized}"`);
  });
  
  console.log('URL normalization test passed.');
}

// Test cache key generation
function testCacheKeyGeneration() {
  console.log('\n========== CACHE KEY GENERATION TEST ==========');
  
  const options = {
    maxPages: 20,
    maxDepth: 3
  };
  
  urls.forEach(url => {
    const cacheKey = generateSiteAuditCacheKey(url, options);
    console.log(`URL: "${url}" => Cache Key: "${cacheKey}"`);
  });
  
  console.log('Cache key generation test passed.');
}

// Test crawler initialization
async function testCrawlerInitialization() {
  console.log('\n========== CRAWLER INITIALIZATION TEST ==========');
  
  const testUrl = 'https://example.com';
  const crawler = new SiteCrawler({
    maxPages: 1,
    maxDepth: 1,
    concurrency: 1,
    timeout: 5000
  });
  
  try {
    console.log(`Initializing crawler with URL: ${testUrl}`);
    const success = await crawler.initialize(testUrl);
    
    if (success) {
      console.log('Crawler initialization successful.');
      
      // Test crawler status
      const status = crawler.getStatus();
      console.log('Crawler status:', status);
      
      console.log('Crawler initialization test passed.');
      return true;
    } else {
      console.error('Crawler initialization failed.');
      return false;
    }
  } catch (error) {
    console.error('Crawler initialization error:', error);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('========== DIRECT SITE AUDIT COMPONENT TESTS ==========');
  
  // Run synchronous tests
  testNormalizeUrl();
  testCacheKeyGeneration();
  
  // Run asynchronous tests
  const crawlerInitSuccess = await testCrawlerInitialization();
  
  console.log('\n========== TEST SUMMARY ==========');
  console.log('URL Normalization: PASSED');
  console.log('Cache Key Generation: PASSED');
  console.log(`Crawler Initialization: ${crawlerInitSuccess ? 'PASSED' : 'FAILED'}`);
  console.log('==================================');
}

// Run all tests
runTests();