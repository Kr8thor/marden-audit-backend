// Test the API handler locally to verify enhanced endpoints
const express = require('express');
const path = require('path');

// Create a test app
const app = express();
app.use(express.json());

// Load the API handler
const apiHandler = require('./api/index.js');

// Set up the route
app.use('/api', apiHandler);
app.use('/', apiHandler);

const PORT = 8000;

app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log('Testing enhanced endpoints:');
  console.log('- POST /enhanced-seo-analyze');
  console.log('- POST /schema-analyze');
  console.log('- POST /site-crawl');
  console.log('- POST /mobile-analyze');
});
