// Frontend Integration Test Script
const axios = require('axios');

const API_URL = 'https://marden-audit-backend-production.up.railway.app';
const FRONTEND_URL = 'https://glittering-granita-92b678.netlify.app';

async function testFrontendIntegration() {
    console.log('🧪 FRONTEND INTEGRATION TESTING');
    console.log('================================');
    
    // Test 1: API Connectivity from Frontend Domain
    console.log('\n1. Testing API connectivity with frontend CORS...');
    try {
        const response = await axios.get(`${API_URL}/health`, {
            headers: {
                'Origin': FRONTEND_URL,
                'User-Agent': 'Mozilla/5.0 (Frontend Integration Test)'
            }
        });
        
        console.log('✅ API Health Check: SUCCESS');
        console.log(`   Memory: ${response.data.memory}`);
        console.log(`   Status: ${response.data.status}`);
    } catch (error) {
        console.log('❌ API Health Check: FAILED');
        console.log(`   Error: ${error.message}`);
    }
    
    // Test 2: SEO Analysis with Frontend Headers
    console.log('\n2. Testing SEO analysis with frontend headers...');
    try {
        const response = await axios.post(`${API_URL}/seo-analyze`, 
            { url: 'https://www.w3.org' },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': FRONTEND_URL,
                    'User-Agent': 'Mozilla/5.0 (Frontend Integration Test)'
                }
            }
        );
        
        if (response.data.status === 'ok' && response.data.data) {
            console.log('✅ SEO Analysis: SUCCESS');
            console.log(`   Score: ${response.data.data.score}`);
            console.log(`   Title: ${response.data.data.pageData.title.text.substring(0, 50)}...`);
            console.log(`   Analysis Time: ${response.data.executionTime}ms`);
            console.log(`   Cached: ${response.data.cached}`);
        } else {
            console.log('❌ SEO Analysis: FAILED - Invalid response structure');
        }
    } catch (error) {
        console.log('❌ SEO Analysis: FAILED');
        console.log(`   Error: ${error.message}`);
    }
    
    // Test 3: Enhanced Features
    console.log('\n3. Testing enhanced features...');
    
    // Schema Analysis
    try {
        const response = await axios.post(`${API_URL}/schema-analyze`, 
            { url: 'https://schema.org' },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': FRONTEND_URL
                }
            }
        );
        
        if (response.data.status === 'ok') {
            console.log('✅ Schema Analysis: SUCCESS');
            console.log(`   Schema Present: ${response.data.data.structuredData.present}`);
            console.log(`   Schema Count: ${response.data.data.structuredData.count}`);
            console.log(`   Schema Types: ${response.data.data.structuredData.types.slice(0, 3).join(', ')}...`);
        }
    } catch (error) {
        console.log('❌ Schema Analysis: FAILED');
        console.log(`   Error: ${error.message}`);
    }
    
    // Mobile Analysis
    try {
        const response = await axios.post(`${API_URL}/mobile-analyze`, 
            { url: 'https://www.apple.com' },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': FRONTEND_URL
                }
            }
        );
        
        if (response.data.status === 'ok') {
            console.log('✅ Mobile Analysis: SUCCESS');
            console.log(`   Mobile Score: ${response.data.data.mobileFriendliness.score}`);
            console.log(`   Status: ${response.data.data.mobileFriendliness.status}`);
            console.log(`   Issues: ${response.data.data.mobileFriendliness.issues.length}`);
        }
    } catch (error) {
        console.log('❌ Mobile Analysis: FAILED');
        console.log(`   Error: ${error.message}`);
    }
    
    // Test 4: Frontend Accessibility
    console.log('\n4. Testing frontend accessibility...');
    try {
        const response = await axios.get(FRONTEND_URL);
        
        if (response.status === 200) {
            console.log('✅ Frontend Accessibility: SUCCESS');
            console.log(`   Status: ${response.status}`);
            console.log(`   Content Length: ${response.data.length} bytes`);
            
            // Check for key elements
            const hasTitle = response.data.includes('<title>');
            const hasMetaDescription = response.data.includes('name="description"');
            const hasSeoContent = response.data.toLowerCase().includes('seo');
            
            console.log(`   Has Title: ${hasTitle}`);
            console.log(`   Has Meta Description: ${hasMetaDescription}`);
            console.log(`   Has SEO Content: ${hasSeoContent}`);
        }
    } catch (error) {
        console.log('❌ Frontend Accessibility: FAILED');
        console.log(`   Error: ${error.message}`);
    }
    
    console.log('\n🏁 INTEGRATION TESTING COMPLETE');
    console.log('================================');
}

// Run the test
testFrontendIntegration().catch(console.error);
