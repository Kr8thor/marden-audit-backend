/**
 * Marden SEO Audit Tool - Enhanced Features Test Script
 * 
 * This script tests all the new enhanced endpoints to verify functionality
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_URL = 'https://example.com'; // URL to test against

// Helper function to make API requests
async function makeRequest(endpoint, method = 'GET', data = null) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`Making ${method} request to ${url}`);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MardenSEO-Test/1.0'
      }
    };
    
    if (data) {
      options.data = JSON.stringify(data);
    }
    
    const response = await axios(url, options);
    return response.data;
  } catch (error) {
    console.error(`Error making request to ${endpoint}:`, error.message);
    
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    
    throw error;
  }
}

// Test the health endpoint
async function testHealthEndpoint() {
  console.log('\n=== Testing Health Endpoint ===');
  try {
    const result = await makeRequest('/health');
    console.log('Health check status:', result.status);
    console.log('Redis status:', result.components?.redis?.status);
    return true;
  } catch (error) {
    console.error('Health check failed');
    return false;
  }
}

// Test the basic SEO analysis endpoint
async function testBasicSeoAnalysis() {
  console.log('\n=== Testing Basic SEO Analysis ===');
  try {
    const result = await makeRequest(`/seo-analyze?url=${TEST_URL}`);
    console.log('Status:', result.status);
    console.log('URL:', result.url);
    console.log('Cached:', result.cached);
    console.log('Score:', result.data?.score);
    console.log('Issues found:', result.data?.issuesFound);
    return true;
  } catch (error) {
    console.error('Basic SEO Analysis failed');
    return false;
  }
}

// Test the schema analysis endpoint
async function testSchemaAnalysis() {
  console.log('\n=== Testing Schema Analysis ===');
  try {
    const result = await makeRequest(`/schema-analyze?url=${TEST_URL}`);
    console.log('Status:', result.status);
    console.log('Schema present:', result.data?.structuredData?.present);
    console.log('Schema count:', result.data?.structuredData?.count);
    console.log('Schema types:', result.data?.structuredData?.types);
    return true;
  } catch (error) {
    console.error('Schema Analysis failed');
    return false;
  }
}

// Test the mobile-friendly analysis endpoint
async function testMobileAnalysis() {
  console.log('\n=== Testing Mobile-Friendly Analysis ===');
  try {
    const result = await makeRequest(`/mobile-analyze?url=${TEST_URL}`);
    console.log('Status:', result.status);
    console.log('Mobile score:', result.data?.mobileFriendliness?.score);
    console.log('Mobile status:', result.data?.mobileFriendliness?.status);
    console.log('Viewport:', result.data?.mobileFriendliness?.factors?.viewport?.present);
    return true;
  } catch (error) {
    console.error('Mobile-Friendly Analysis failed');
    return false;
  }
}

// Test the enhanced SEO analysis endpoint
async function testEnhancedAnalysis() {
  console.log('\n=== Testing Enhanced SEO Analysis ===');
  try {
    const data = {
      url: TEST_URL,
      options: {
        mobileAnalysis: true,
        schemaAnalysis: true,
        siteCrawl: false
      }
    };
    
    const result = await makeRequest('/enhanced-seo-analyze', 'POST', data);
    console.log('Status:', result.status);
    console.log('Analysis type:', result.data?.analysisType);
    console.log('Score:', result.data?.score);
    console.log('Components:', Object.keys(result.data?.components || {}));
    console.log('Recommendations count:', result.data?.recommendations?.length);
    return true;
  } catch (error) {
    console.error('Enhanced SEO Analysis failed');
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('=== Starting Marden SEO Audit Tool Enhanced Features Test ===');
  console.log('API Base URL:', API_BASE_URL);
  console.log('Test URL:', TEST_URL);
  
  // Record test results
  const results = {
    health: await testHealthEndpoint(),
    basicSeo: await testBasicSeoAnalysis(),
    schema: await testSchemaAnalysis(),
    mobile: await testMobileAnalysis(),
    enhanced: await testEnhancedAnalysis()
  };
  
  // Log summary
  console.log('\n=== Test Results Summary ===');
  for (const [test, result] of Object.entries(results)) {
    console.log(`${test}: ${result ? '✅ PASSED' : '❌ FAILED'}`);
  }
  
  // Overall result
  const allPassed = Object.values(results).every(Boolean);
  console.log(`\nOverall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
}

// Run tests when called directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };
