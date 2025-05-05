/**
 * Final verification test for site-audit.js
 * Tests the complete site audit functionality with example.org
 */

// Import the site audit module
const { performSiteAudit } = require('../src/crawler/site-audit');

// Test with the reliable site that worked in crawler test
const testUrl = 'https://example.org';

// Minimal configuration for quicker testing
const testConfig = {
  maxPages: 2,
  maxDepth: 1,
  concurrency: 1,
  timeout: 10000,  // Longer timeout
  respectRobots: true,
  cacheResults: false
};

/**
 * Run the final verification test
 */
async function runFinalTest() {
  console.log('==================================================');
  console.log('FINAL SITE AUDIT VERIFICATION TEST');
  console.log('==================================================\n');
  
  console.log(`Target URL: ${testUrl}`);
  console.log(`Options: ${JSON.stringify(testConfig, null, 2)}`);
  console.log(`================================================\n`);
  
  try {
    console.time('Test Duration');
    
    // Perform the site audit
    console.log('Starting site audit...');
    const results = await performSiteAudit(testUrl, testConfig);
    
    console.timeEnd('Test Duration');
    
    // Check for errors
    if (results.error) {
      console.error('TEST FAILED');
      console.error(`Error: ${results.error.message}`);
      return false;
    }
    
    // Print results summary
    console.log('\n========== SITE AUDIT RESULTS ==========');
    console.log(`Overall Score: ${results.overallScore || 'N/A'}`);
    console.log(`Overall Status: ${results.overallStatus || 'N/A'}`);
    
    // Crawl stats
    if (results.crawlStats) {
      console.log('\nCrawl Statistics:');
      console.log(`  Pages Discovered: ${results.crawlStats.pagesDiscovered}`);
      console.log(`  Pages Crawled: ${results.crawlStats.pagesCrawled}`);
      console.log(`  Crawl Duration: ${results.crawlStats.crawlDuration}ms`);
    }
    
    // Analysis stats
    if (results.analysisStats) {
      console.log('\nAnalysis Statistics:');
      console.log(`  Pages Analyzed: ${results.analysisStats.pagesAnalyzed}`);
      console.log(`  Pages Succeeded: ${results.analysisStats.pagesSucceeded}`);
      console.log(`  Pages Failed: ${results.analysisStats.pagesFailed}`);
    }
    
    // Page sample
    if (results.pages && results.pages.length > 0) {
      console.log('\nAnalyzed Pages Sample:');
      const sampleSize = Math.min(2, results.pages.length);
      
      for (let i = 0; i < sampleSize; i++) {
        const page = results.pages[i];
        console.log(`\n  [${i+1}] ${page.url}`);
        console.log(`    Score: ${page.score}`);
        console.log(`    Status: ${page.status}`);
        
        if (page.pageData) {
          console.log(`    Title: ${page.pageData.title ? page.pageData.title.text : 'N/A'}`);
          if (page.pageData.metaDescription) {
            console.log(`    Description: ${page.pageData.metaDescription.text.substring(0, 50)}...`);
          }
          console.log(`    Headings: H1=${page.pageData.headings.h1Count}, H2=${page.pageData.headings.h2Count}`);
        }
        
        // Show a sample of issues if any
        if (page.totalIssuesCount > 0) {
          console.log(`    Issues: ${page.totalIssuesCount} (${page.criticalIssuesCount} critical)`);
          
          // Sample issue categories
          for (const [category, data] of Object.entries(page.categories)) {
            if (data.issues && data.issues.length > 0) {
              console.log(`      ${category}: ${data.issues.length} issues`);
            }
          }
        }
      }
    }
    
    // Validate test
    const pagesAnalyzed = results.pages?.length || 0;
    const pagesCrawled = results.crawlStats?.pagesCrawled || 0;
    const success = pagesAnalyzed > 0 && pagesCrawled > 0 && results.overallScore !== undefined;
    
    if (success) {
      console.log('\n======= FINAL TEST PASSED =======');
      console.log('The site-audit.js file can successfully crawl and analyze a website.');
      return true;
    } else {
      console.error('\n======= FINAL TEST FAILED =======');
      console.error('Site audit did not produce valid results.');
      return false;
    }
  } catch (error) {
    console.error('\nFINAL TEST ERROR');
    console.error(error);
    return false;
  }
}

// Run the test
runFinalTest()
  .then(success => {
    console.log(`\nFinal verification ${success ? 'completed successfully' : 'failed'}.`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error running final test:', error);
    process.exit(1);
  });
