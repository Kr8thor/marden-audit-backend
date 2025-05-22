// Debug script to test API functionality locally
const express = require('express');
const { handleSeoAnalyze } = require('./api/site-audit');

const app = express();
app.use(express.json());

// Add CORS headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Test route
app.post('/test-seo', async (req, res) => {
  try {
    console.log('Testing SEO analysis with request:', req.body);
    await handleSeoAnalyze(req, res);
  } catch (error) {
    console.error('Error in handleSeoAnalyze:', error);
    res.status(500).json({
      error: 'Debug Error',
      message: error.message,
      stack: error.stack
    });
  }
});

app.listen(3001, () => {
  console.log('Debug server running on port 3001');
  console.log('Test with: curl -X POST -H "Content-Type: application/json" -d \'{"url":"https://example.com"}\' http://localhost:3001/test-seo');
});
