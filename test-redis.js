// Test Redis connection
const fetch = require('node-fetch');

const REDIS_URL = 'https://smiling-shrimp-21387.upstash.io';
const REDIS_TOKEN = 'AVOLAAIjcDFmNzVjNDVjZGM3MGY0NDczODEyMTA0NTAyOGNkMTc5OXAxMA';

async function testRedisConnection() {
  try {
    // Test with PING command
    const response = await fetch(`${REDIS_URL}/ping`, {
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Redis responded with status ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Redis connection test result:', data);
    
    if (data.result === 'PONG') {
      console.log('✅ Redis connection successful!');
      
      // Set a test value
      const setResponse = await fetch(`${REDIS_URL}/set/test-key/test-value?EX=60`, {
        headers: {
          Authorization: `Bearer ${REDIS_TOKEN}`
        }
      });
      
      const setData = await setResponse.json();
      console.log('Set test key result:', setData);
      
      // Get the test value
      const getResponse = await fetch(`${REDIS_URL}/get/test-key`, {
        headers: {
          Authorization: `Bearer ${REDIS_TOKEN}`
        }
      });
      
      const getData = await getResponse.json();
      console.log('Get test key result:', getData);
    } else {
      console.log('❌ Redis connection failed!');
    }
  } catch (error) {
    console.error('Error testing Redis connection:', error);
  }
}

testRedisConnection();
