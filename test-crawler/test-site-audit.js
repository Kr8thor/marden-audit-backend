/**
 * Test script for site-audit.js to verify full website crawling
 * This approach avoids circular dependency issues
 */

// Import the site-crawler directly to prevent circular dependencies
const SiteCrawler = require('../src/crawler/site-crawler');

// Import URL normalization function
const { URL } = require('url');

// Test URL - update this to a valid URL for testing
const testUrl = 'https://example.com';

// Test configuration
const options = {
  maxPages: 10,       // Limit to 10 pages for test
  maxDepth: 2,        // Limit depth to 2 for test
  concurrency: 2,     // Limit concurrency to 2 for test
  timeout: 10000,     // 10 second timeout
  respectRobots: true,
  cacheResults: false, // Skip cache for testing
  includeMedia: false
};

/**
 * Test the site crawler functionality
 */
async function testSiteCrawling() {
  console.log(`\n============ SITE CRAWLER TEST ============`);
  console.log(`Starting site crawler test for: ${testUrl}`);
  console.log(`Options: ${JSON.stringify(options, null, 2)}`);
  console.log(`========================================\n`);

  try {
    console.time('Crawl Duration');
    
    // Initialize the crawler
    const crawler = new SiteCrawler({
      maxPages: options.maxPages,
      maxDepth: options.maxDepth,
      concurrency: options.concurrency,
      timeout: options.timeout,
      respectRobots: options.respectRobots
    });
    
    // Initialize with the test URL
    console.log(`Initializing crawler with URL: ${testUrl}`);
    await crawler.initialize(testUrl);
    
    // Run the crawl
    console.log(`Starting crawl...`);
    const results = await crawler.crawl();
    
    console.timeEnd('Crawl Duration');
    
    // Print summary results
    console.log(`\n========== CRAWL RESULTS ==========`);
    console.log(`Target URL: ${results.startUrl}`);
    console.log(`Base Domain: ${results.baseDomain}`);
    console.log(`Pages Discovered: ${results.pagesDiscovered}`);
    console.log(`Pages Crawled: ${results.pagesCrawled}`);
    console.log(`Pages Failed: ${results.pagesFailed}`);
    console.log(`Max Depth Reached: ${results.maxDepthReached}`);
    console.log(`Crawl Duration: ${results.crawlDuration}ms (${(results.crawlDuration / 1000).toFixed(1)}s)`);
    
    // Display a sample of crawled pages
    if (results.crawledPages && results.crawledPages.length > 0) {
      console.log(`\nSample of Crawled Pages:`);
      const sampleSize = Math.min(5, results.crawledPages.length);
      
      for (let i = 0; i < sampleSize; i++) {
        const page = results.crawledPages[i];
        console.log(`  [${i + 1}] ${page.url}`);
        console.log(`    Title: ${page.title || 'No title'}`);
        console.log(`    Depth: ${page.depth}`);
      }
      
      console.log(`  ... and ${results.crawledPages.length - sampleSize} more pages`);
    }
    
    console.log(`\n============ TEST COMPLETE ============\n`);
    return true;
  } catch (error) {
    console.error('Test failed with error:', error);
    return false;
  }
}

// Run the test
testSiteCrawling();
