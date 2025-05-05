/**
 * Simplified verification script for site-audit.js
 * Tests that the site audit functionality can properly crawl a website
 * with minimal settings for quicker testing
 */

// Import directly to avoid circular dependency issues
const { performSiteAudit } = require('../src/crawler/site-audit');

// Test URL - using a simple, reliable website for testing
const testUrl = 'https://example.com';

// Use minimal settings
const testConfig = {
  maxPages: 2,       // Only crawl max 2 pages
  maxDepth: 1,       // Only go 1 level deep
  concurrency: 1,    // Process 1 page at a time
  timeout: 5000,     // Short timeout
  respectRobots: true,
  cacheResults: false
};

/**
 * Run a simplified test
 */
async function runSimpleTest() {
  console.log('==================================================');
  console.log('STARTING SIMPLIFIED SITE AUDIT VERIFICATION TEST');
  console.log('==================================================\n');
  
  console.log(`Target URL: ${testUrl}`);
  console.log(`Options: ${JSON.stringify(testConfig, null, 2)}`);
  console.log(`================================================\n`);
  
  try {
    console.time('Test Duration');
    
    // Perform site audit with minimal configuration
    const results = await performSiteAudit(testUrl, testConfig);
    
    console.timeEnd('Test Duration');
    
    // Validate results
    if (results.error) {
      console.error(`TEST FAILED`);
      console.error(`Error: ${results.error.message}`);
      return false;
    }
    
    // Print summary
    console.log(`\n========== TEST RESULTS ==========`);
    
    // Check that we have pages and crawl stats
    const pagesAnalyzed = results.pages?.length || 0;
    const pagesCrawled = results.crawlStats?.pagesCrawled || 0;
    
    console.log(`Pages Crawled: ${pagesCrawled}`);
    console.log(`Pages Analyzed: ${pagesAnalyzed}`);
    console.log(`Overall Score: ${results.overallScore || 'N/A'}`);
    
    // Basic validation
    const valid = pagesAnalyzed > 0 && pagesCrawled > 0;
    
    if (valid) {
      console.log(`\n======= TEST PASSED =======\n`);
      
      // Show sample of the first page
      if (results.pages && results.pages.length > 0) {
        const firstPage = results.pages[0];
        console.log(`Sample Page: ${firstPage.url}`);
        console.log(`Score: ${firstPage.score}`);
        console.log(`Status: ${firstPage.status}`);
        
        if (firstPage.pageData) {
          console.log(`Title: ${firstPage.pageData.title ? firstPage.pageData.title.text : 'N/A'}`);
        }
      }
      
      return true;
    } else {
      console.error(`\n======= TEST FAILED =======\n`);
      console.error('Validation failed: No pages analyzed or crawled');
      return false;
    }
  } catch (error) {
    console.error(`\nTEST ERROR`);
    console.error(error);
    console.log(`\n======= TEST FAILED =======\n`);
    return false;
  }
}

// Run the test
runSimpleTest()
  .then(success => {
    console.log(`\nVerification ${success ? 'completed successfully' : 'failed'}.`);
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error running test:', error);
    process.exit(1);
  });
