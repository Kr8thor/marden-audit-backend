/**
 * Direct test for SiteCrawler to verify standalone crawling functionality
 */

// Import only the crawler module
const SiteCrawler = require('../src/crawler/site-crawler');

// Test with a reliable site that should be quickly accessible
const testUrl = 'https://example.org';

// Configure minimal crawl settings
const crawlConfig = {
  maxPages: 2,
  maxDepth: 1,
  concurrency: 1,
  timeout: 10000, // Increased timeout to 10 seconds
  respectRobots: true
};

/**
 * Test the crawler in isolation
 */
async function testCrawler() {
  console.log('==================================================');
  console.log('SITE CRAWLER DIRECT FUNCTIONALITY TEST');
  console.log('==================================================\n');
  
  console.log(`Target URL: ${testUrl}`);
  console.log(`Options: ${JSON.stringify(crawlConfig, null, 2)}`);
  console.log(`================================================\n`);
  
  try {
    // Initialize crawler with config
    console.log('Initializing crawler...');
    const crawler = new SiteCrawler(crawlConfig);
    
    // Initialize with URL
    console.log(`Initializing with URL: ${testUrl}`);
    const initSuccess = await crawler.initialize(testUrl);
    
    if (!initSuccess) {
      console.error('Failed to initialize crawler');
      return false;
    }
    
    console.log('Starting crawl...');
    console.time('Crawl Duration');
    
    // Execute the crawl
    const results = await crawler.crawl();
    
    console.timeEnd('Crawl Duration');
    
    // Check results
    console.log('\n========== CRAWL RESULTS ==========');
    console.log(`Pages Discovered: ${results.pagesDiscovered}`);
    console.log(`Pages Crawled: ${results.pagesCrawled}`);
    console.log(`Pages Failed: ${results.pagesFailed}`);
    console.log(`Base Domain: ${results.baseDomain}`);
    console.log(`Crawl Duration: ${results.crawlDuration}ms`);
    console.log(`Max Depth Reached: ${results.maxDepthReached || 0}`);
    
    // Display sample of crawled pages
    if (results.crawledPages && results.crawledPages.length > 0) {
      console.log('\nCrawled Pages Sample:');
      const sampleSize = Math.min(2, results.crawledPages.length);
      
      for (let i = 0; i < sampleSize; i++) {
        const page = results.crawledPages[i];
        console.log(`\n  [${i+1}] ${page.url}`);
        console.log(`    Title: ${page.title || 'N/A'}`);
        console.log(`    Depth: ${page.depth}`);
      }
    }
    
    // Basic validation
    const success = results.pagesCrawled > 0;
    
    if (success) {
      console.log('\n======= CRAWLER TEST PASSED =======');
      return true;
    } else {
      console.error('\n======= CRAWLER TEST FAILED =======');
      console.error('No pages were successfully crawled');
      return false;
    }
  } catch (error) {
    console.error('\nCRAWLER TEST ERROR');
    console.error(error);
    return false;
  }
}

// Run the test
testCrawler()
  .then(success => {
    console.log(`\nCrawler verification ${success ? 'completed successfully' : 'failed'}.`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error running crawler test:', error);
    process.exit(1);
  });
