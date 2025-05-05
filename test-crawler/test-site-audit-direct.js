/**
 * Direct test for site-audit.js after fixing the circular dependency issue
 */

// Import the site-audit module now that the circular dependency is fixed
const siteAudit = require('../src/crawler/site-audit');

// Test URL - using a simple website for testing
const testUrl = 'https://example.com';

// Test configuration
const options = {
  maxPages: 5,       // Limit to 5 pages for the test
  maxDepth: 1,       // Limit depth to 1 for the test
  concurrency: 2,     // Use lower concurrency for test
  timeout: 8000,      // Shorter timeout for test
  respectRobots: true,
  cacheResults: false // Disable caching for test
};

// Run a site audit test
async function runSiteAuditTest() {
  console.log(`\n============ SITE AUDIT TEST ============`);
  console.log(`Starting site audit for: ${testUrl}`);
  console.log(`Options: ${JSON.stringify(options, null, 2)}`);
  console.log(`========================================\n`);
  
  try {
    console.time('Audit Duration');
    
    // Perform site audit
    const results = await siteAudit.performSiteAudit(testUrl, options);
    
    console.timeEnd('Audit Duration');
    
    // Print summary
    console.log(`\n========== AUDIT RESULTS ==========`);
    console.log(`Target URL: ${results.url}`);
    
    if (results.error) {
      console.error(`Audit failed: ${results.error.message}`);
      return false;
    }
    
    console.log(`Overall Score: ${results.overallScore}`);
    console.log(`Overall Status: ${results.overallStatus}`);
    console.log(`Pages Found: ${results.crawlStats.pagesDiscovered}`);
    console.log(`Pages Analyzed: ${results.pages.length}`);
    console.log(`Audit Duration: ${results.auditDuration}ms (${(results.auditDuration / 1000).toFixed(1)}s)`);
    
    // Display a sample of analyzed pages
    if (results.pages && results.pages.length > 0) {
      console.log(`\nSample of Analyzed Pages:`);
      const sampleSize = Math.min(3, results.pages.length);
      
      for (let i = 0; i < sampleSize; i++) {
        const page = results.pages[i];
        console.log(`\n  [${i + 1}] ${page.url}`);
        console.log(`    Score: ${page.score}`);
        console.log(`    Status: ${page.status}`);
        
        // Show page data if available
        if (page.pageData) {
          console.log(`    Title: ${page.pageData.title.text}`);
          console.log(`    Description: ${page.pageData.metaDescription ? page.pageData.metaDescription.text.substring(0, 30) + '...' : 'None'}`);
        }
      }
      
      if (results.pages.length > sampleSize) {
        console.log(`  ... and ${results.pages.length - sampleSize} more pages`);
      }
    }
    
    console.log(`\n========== TEST COMPLETE ==========\n`);
    return true;
  } catch (error) {
    console.error('Test failed with error:', error);
    return false;
  }
}

// Run the test
runSiteAuditTest().then(success => {
  console.log(`Site audit test ${success ? 'PASSED' : 'FAILED'}`);
});