// COMPREHENSIVE SYSTEM TEST - End-to-End Verification
const axios = require('axios');

const API_URL = 'https://marden-audit-backend-production.up.railway.app';
const FRONTEND_URL = 'https://glittering-granita-92b678.netlify.app';

async function comprehensiveSystemTest() {
    console.log('🎯 COMPREHENSIVE SYSTEM TEST');
    console.log('=============================');
    console.log(`Backend: ${API_URL}`);
    console.log(`Frontend: ${FRONTEND_URL}`);
    console.log('');
    
    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };
    
    function addResult(name, success, details = '') {
        results.tests.push({ name, success, details });
        if (success) {
            results.passed++;
            console.log(`✅ ${name}: PASSED ${details}`);
        } else {
            results.failed++;
            console.log(`❌ ${name}: FAILED ${details}`);
        }
    }
    
    // Test 1: System Health
    try {
        const health = await axios.get(`${API_URL}/health`);
        addResult('System Health', health.data.status === 'ok', `Memory: ${health.data.memory}`);
    } catch (error) {
        addResult('System Health', false, error.message);
    }
    
    // Test 2: Basic SEO Analysis
    try {
        const seo = await axios.post(`${API_URL}/seo-analyze`, { url: 'https://www.w3.org' });
        const isReal = seo.data.data && seo.data.data.score > 0 && seo.data.data.pageData.title.text.includes('W3C');
        addResult('Basic SEO Analysis', isReal, `Score: ${seo.data.data.score}, Real data detected`);
    } catch (error) {
        addResult('Basic SEO Analysis', false, error.message);
    }
    
    // Test 3: Schema Analysis
    try {
        const schema = await axios.post(`${API_URL}/schema-analyze`, { url: 'https://schema.org' });
        const hasSchema = schema.data.data.structuredData.present && schema.data.data.structuredData.count > 0;
        addResult('Schema Analysis', hasSchema, `Found ${schema.data.data.structuredData.count} schemas`);
    } catch (error) {
        addResult('Schema Analysis', false, error.message);
    }
    
    // Test 4: Mobile Analysis
    try {
        const mobile = await axios.post(`${API_URL}/mobile-analyze`, { url: 'https://www.google.com' });
        const hasMobile = mobile.data.data.mobileFriendliness && mobile.data.data.mobileFriendliness.score > 0;
        addResult('Mobile Analysis', hasMobile, `Score: ${mobile.data.data.mobileFriendliness.score}`);
    } catch (error) {
        addResult('Mobile Analysis', false, error.message);
    }
    
    // Test 5: Error Handling
    try {
        const errorTest = await axios.post(`${API_URL}/seo-analyze`, { url: 'invalid-url' });
        const hasError = errorTest.data.data.status === 'error' && errorTest.data.data.error.message.includes('ENOTFOUND');
        addResult('Error Handling', hasError, 'Proper DNS error handling');
    } catch (error) {
        addResult('Error Handling', false, error.message);
    }
    
    // Test 6: Frontend Accessibility
    try {
        const frontend = await axios.get(FRONTEND_URL);
        const hasTitle = frontend.data.includes('<title>') && frontend.data.includes('SEO');
        addResult('Frontend Accessibility', hasTitle, `Status: ${frontend.status}`);
    } catch (error) {
        addResult('Frontend Accessibility', false, error.message);
    }
    
    // Test 7: CORS Integration
    try {
        const corsTest = await axios.post(`${API_URL}/seo-analyze`, 
            { url: 'https://example.com' },
            { headers: { 'Origin': FRONTEND_URL } }
        );
        addResult('CORS Integration', corsTest.status === 200, 'Frontend-backend communication working');
    } catch (error) {
        addResult('CORS Integration', false, error.message);
    }
    
    // Test 8: Performance Test
    const startTime = Date.now();
    try {
        const perf = await axios.post(`${API_URL}/seo-analyze`, { url: 'https://www.github.com' });
        const responseTime = Date.now() - startTime;
        const isPerformant = responseTime < 3000; // Less than 3 seconds
        addResult('Performance Test', isPerformant, `Response time: ${responseTime}ms`);
    } catch (error) {
        addResult('Performance Test', false, error.message);
    }
    
    // Test 9: Caching Test
    try {
        const url = 'https://www.wikipedia.org';
        const first = await axios.post(`${API_URL}/seo-analyze`, { url });
        const second = await axios.post(`${API_URL}/seo-analyze`, { url });
        const isCaching = second.data.executionTime < first.data.executionTime;
        addResult('Caching System', isCaching, `First: ${first.data.executionTime}ms, Second: ${second.data.executionTime}ms`);
    } catch (error) {
        addResult('Caching System', false, error.message);
    }
    
    // Test 10: Real Data Verification
    try {
        const sites = ['https://www.apple.com', 'https://www.microsoft.com', 'https://www.amazon.com'];
        const analyses = await Promise.all(
            sites.map(url => axios.post(`${API_URL}/seo-analyze`, { url }))
        );
        
        const scores = analyses.map(a => a.data.data.score);
        const titles = analyses.map(a => a.data.data.pageData.title.text);
        
        const allDifferent = new Set(scores).size > 1 && new Set(titles).size === 3;
        addResult('Real Data Verification', allDifferent, 'Different sites return different results');
    } catch (error) {
        addResult('Real Data Verification', false, error.message);
    }
    
    // Summary
    console.log('\n📊 TEST SUMMARY');
    console.log('================');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
    
    if (results.failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! System is fully operational.');
    } else {
        console.log('\n⚠️ Some tests failed. Review issues above.');
    }
    
    console.log('\n🏁 COMPREHENSIVE TESTING COMPLETE');
    return results;
}

comprehensiveSystemTest().catch(console.error);
