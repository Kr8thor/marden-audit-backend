// Load Testing Script - Test concurrency limits
const axios = require('axios');

const API_URL = 'https://marden-audit-backend-production.up.railway.app';

async function testConcurrency() {
    console.log('🚀 CONCURRENCY LOAD TESTING');
    console.log('============================');
    
    const testUrls = [
        'https://www.google.com',
        'https://www.github.com',
        'https://www.stackoverflow.com',
        'https://www.reddit.com',
        'https://www.wikipedia.org'
    ];
    
    console.log(`Testing ${testUrls.length} concurrent SEO analysis requests...`);
    
    const startTime = Date.now();
    
    try {
        const promises = testUrls.map((url, index) => 
            axios.post(`${API_URL}/seo-analyze`, { url }, {
                headers: { 'Content-Type': 'application/json' }
            }).then(response => ({
                index,
                url,
                success: true,
                score: response.data.data.score,
                executionTime: response.data.executionTime,
                cached: response.data.cached
            })).catch(error => ({
                index,
                url,
                success: false,
                error: error.message
            }))
        );
        
        const results = await Promise.all(promises);
        const totalTime = Date.now() - startTime;
        
        console.log('\n📊 RESULTS:');
        console.log(`Total time: ${totalTime}ms`);
        console.log(`Average time per request: ${Math.round(totalTime / testUrls.length)}ms`);
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`\n✅ Successful requests: ${successful.length}/${testUrls.length}`);
        console.log(`❌ Failed requests: ${failed.length}/${testUrls.length}`);
        
        if (successful.length > 0) {
            console.log('\n🎯 Successful Results:');
            successful.forEach(result => {
                console.log(`   ${result.url}: Score ${result.score}, Time ${result.executionTime}ms, Cached: ${result.cached}`);
            });
        }
        
        if (failed.length > 0) {
            console.log('\n💥 Failed Results:');
            failed.forEach(result => {
                console.log(`   ${result.url}: ${result.error}`);
            });
        }
        
        // Test rapid sequential requests (caching test)
        console.log('\n🔄 CACHING TEST (Rapid Sequential Requests)');
        const testUrl = 'https://www.example.com';
        
        console.log('First request (should be uncached)...');
        const first = await axios.post(`${API_URL}/seo-analyze`, { url: testUrl }, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('Second request (should be cached)...');
        const second = await axios.post(`${API_URL}/seo-analyze`, { url: testUrl }, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log(`First request - Time: ${first.data.executionTime}ms, Cached: ${first.data.cached}`);
        console.log(`Second request - Time: ${second.data.executionTime}ms, Cached: ${second.data.cached}`);
        
        if (second.data.executionTime < first.data.executionTime) {
            console.log('✅ Caching is working - second request was faster!');
        } else {
            console.log('⚠️ Caching may not be working optimally');
        }
        
    } catch (error) {
        console.log(`❌ Load testing failed: ${error.message}`);
    }
    
    console.log('\n🏁 LOAD TESTING COMPLETE');
}

testConcurrency().catch(console.error);
