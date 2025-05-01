// Test Redis integration with the main API handler
require('dotenv').config();

// Create a mock request and response
const mockReq = {
  url: '/health',
  method: 'GET',
  body: {},
  query: {}
};

const mockRes = {
  status: (code) => {
    console.log(`Response status: ${code}`);
    return mockRes;
  },
  json: (data) => {
    console.log('Response data:');
    console.log(JSON.stringify(data, null, 2));
    return mockRes;
  },
  end: () => {},
  setHeader: (name, value) => {
    console.log(`Response header: ${name} = ${value}`);
  },
  on: (event, callback) => {}
};

// Log environment variables
console.log('Environment variables:');
console.log('Redis URL:', process.env.UPSTASH_REDIS_REST_URL ? 'Set' : 'Not Set');
console.log('Redis Token:', process.env.UPSTASH_REDIS_REST_TOKEN ? 'Set' : 'Not Set');

// Import the API handler
const apiHandler = require('./api/index.js');

// Call the API handler
console.log('\nCalling API handler with /health endpoint...');
apiHandler(mockReq, mockRes).catch(err => {
  console.error('Error in API handler:', err);
});
