/**
 * Verification script for site-audit.js
 * Tests that the site audit functionality can properly crawl a full website
 */

// Import directly to avoid circular dependency issues
const { performSiteAudit } = require('../src/crawler/site-audit');

// Test URL - using a simple, reliable website for testing
const testUrl = 'https://example.com';

// Test configuration with different options to verify functionality
const testConfigurations = [
  // Default test - low page limit, shallow crawl
  {
    name: 'Basic Test',
    options: {
      maxPages: 5,
      maxDepth: 1,
      concurrency: 2,
      timeout: 10000,
      respectRobots: true,
      cacheResults: false
    }
  },
  // Test with custom pages (skip crawl)
  {
    name: 'Custom Pages Test',
    options: {
      skipCrawl: true,
      customPages: [
        'https://example.com',
        'https://example.com/about',
        'https://example.com/contact'
      ],
      cacheResults: false
    }
  },
  // Test homepage only
  {
    name: 'Homepage Only Test',
    options: {
      skipCrawl: true,
      cacheResults: false
    }
  }
];

/**
 * Run a single test with the given configuration
 * @param {Object} config Test configuration
 * @returns {Promise<boolean>} Test success status
 */
async function runTest(config) {
  console.log(`\n============ RUNNING TEST: ${config.name} ============`);
  console.log(`Target URL: ${testUrl}`);
  console.log(`Options: ${JSON.stringify(config.options, null, 2)}`);
  console.log(`================================================\n`);
  
  try {
    console.time(`${config.name} Duration`);
    
    // Perform site audit with the configuration
    const results = await performSiteAudit(testUrl, config.options);
    
    console.timeEnd(`${config.name} Duration`);
    
    // Validate results
    if (results.error) {
      console.error(`TEST FAILED: ${config.name}`);
      console.error(`Error: ${results.error.message}`);
      return false;
    }
    
    // Print summary
    console.log(`\n========== TEST RESULTS: ${config.name} ==========`);
    console.log(`Status: ${results.status || 'N/A'}`);
    console.log(`Overall Score: ${results.overallScore || 'N/A'}`);
    console.log(`Overall Status: ${results.overallStatus || 'N/A'}`);
    
    // Crawl stats
    if (results.crawlStats) {
      console.log(`\nCrawl Statistics:`);
      console.log(`  Base Domain: ${results.crawlStats.baseDomain}`);
      console.log(`  Pages Discovered: ${results.crawlStats.pagesDiscovered}`);
      console.log(`  Pages Crawled: ${results.crawlStats.pagesCrawled}`);
      console.log(`  Crawl Duration: ${results.crawlStats.crawlDuration}ms`);
    }
    
    // Analysis stats
    if (results.analysisStats) {
      console.log(`\nAnalysis Statistics:`);
      console.log(`  Pages Analyzed: ${results.analysisStats.pagesAnalyzed}`);
      console.log(`  Successful: ${results.analysisStats.pagesSucceeded}`);
      console.log(`  Failed: ${results.analysisStats.pagesFailed}`);
      console.log(`  Average Analysis Time: ${Math.round(results.analysisStats.analysisTime.average)}ms`);
    }
    
    // Check analyzed pages
    if (results.pages && results.pages.length > 0) {
      console.log(`\nAnalyzed Pages: ${results.pages.length}`);
      
      // Sample of pages
      const sampleSize = Math.min(3, results.pages.length);
      for (let i = 0; i < sampleSize; i++) {
        const page = results.pages[i];
        console.log(`\n  Page ${i+1}: ${page.url}`);
        console.log(`    Score: ${page.score}`);
        console.log(`    Status: ${page.status}`);
        
        if (page.pageData) {
          console.log(`    Title: ${page.pageData.title ? page.pageData.title.text : 'N/A'}`);
          console.log(`    Headings: H1=${page.pageData.headings.h1Count}, H2=${page.pageData.headings.h2Count}`);
        }
      }
    }
    
    // Perform some basic validations
    let valid = true;
    
    // 1. Check if URL is set correctly
    if (results.url !== testUrl && !results.url.startsWith('https://example.com')) {
      console.error(`URL validation failed: ${results.url} != ${testUrl}`);
      valid = false;
    }
    
    // 2. For non-skip crawl tests, verify we have crawl results
    if (!config.options.skipCrawl && (!results.crawlStats || !results.crawlStats.pagesCrawled)) {
      console.error('Crawl validation failed: Missing crawl stats');
      valid = false;
    }
    
    // 3. Check we have analysis results
    if (!results.pages || !Array.isArray(results.pages) || results.pages.length === 0) {
      console.error('Analysis validation failed: No pages analyzed');
      valid = false;
    }
    
    // 4. For custom pages test, verify all custom pages were analyzed
    if (config.options.customPages && config.options.customPages.length > 0) {
      const analyzedUrls = new Set(results.pages.map(p => p.url));
      const missingPages = config.options.customPages.filter(url => !analyzedUrls.has(url));
      
      if (missingPages.length > 0) {
        console.error(`Custom pages validation failed: Missing pages: ${missingPages.join(', ')}`);
        valid = false;
      }
    }
    
    // Final test result
    if (valid) {
      console.log(`\n======= TEST PASSED: ${config.name} =======\n`);
      return true;
    } else {
      console.error(`\n======= TEST FAILED: ${config.name} =======\n`);
      return false;
    }
  } catch (error) {
    console.error(`\nTEST ERROR: ${config.name}`);
    console.error(error);
    console.log(`\n======= TEST FAILED: ${config.name} =======\n`);
    return false;
  }
}

/**
 * Run all tests sequentially
 */
async function runAllTests() {
  console.log('==================================================');
  console.log('STARTING SITE AUDIT VERIFICATION TESTS');
  console.log('==================================================\n');
  
  const results = [];
  
  // Run each test sequentially
  for (const config of testConfigurations) {
    const success = await runTest(config);
    results.push({ name: config.name, success });
  }
  
  // Print summary of all tests
  console.log('\n==================================================');
  console.log('TEST RESULTS SUMMARY');
  console.log('==================================================');
  
  let allPassed = true;
  for (const result of results) {
    console.log(`${result.name}: ${result.success ? 'PASSED' : 'FAILED'}`);
    if (!result.success) {
      allPassed = false;
    }
  }
  
  console.log('\n==================================================');
  console.log(`OVERALL RESULT: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('==================================================');
  
  return allPassed;
}

// Run all the tests
runAllTests()
  .then(success => {
    console.log(`\nVerification ${success ? 'completed successfully' : 'failed'}.`);
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error running tests:', error);
    process.exit(1);
  });
