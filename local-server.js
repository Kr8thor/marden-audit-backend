// Express server for both local development and Railway deployment
// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const apiHandler = require('./api/index');
const fs = require('fs');
const path = require('path');

// Check if running on Railway
const isRailway = process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN;

// If we're on Railway and the .env.railway file exists, load it
if (isRailway && fs.existsSync(path.join(__dirname, '.env.railway'))) {
  require('dotenv').config({ path: path.join(__dirname, '.env.railway') });
  console.log('Loaded Railway-specific environment variables');
}

const app = express();
const port = process.env.PORT || 3006; // Use environment variable or 3006 as default

// Enable CORS for all requests with more permissive settings for Railway
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['X-CSRF-Token', 'X-Requested-With', 'Accept', 'Accept-Version', 'Content-Length', 'Content-MD5', 'Content-Type', 'Date', 'X-Api-Version', 'Origin', 'Cache-Control', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204
}));

// Parse JSON and URL-encoded bodies with increased limit for larger requests
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));

// Log environment variables
console.log('Environment variables loaded:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', process.env.PORT);
console.log('- Redis URL:', process.env.UPSTASH_REDIS_REST_URL ? 'Set' : 'Not Set');
console.log('- Redis Token:', process.env.UPSTASH_REDIS_REST_TOKEN ? 'Set' : 'Not Set');
console.log('- Running on Railway:', isRailway ? 'Yes' : 'No');

// Pass all requests to our API handler
app.all('*', (req, res) => {
  // Add timestamp to requests for logging
  req.requestTimestamp = Date.now();
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  return apiHandler(req, res);
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`Health check endpoint: http://${isRailway ? 'your-app' : 'localhost'}:${port}/health`);
  console.log(`API endpoint: http://${isRailway ? 'your-app' : 'localhost'}:${port}/seo-analyze`);
  console.log(`Site audit endpoint: http://${isRailway ? 'your-app' : 'localhost'}:${port}/submit-site-audit`);
  
  if (isRailway) {
    console.log(`Railway deployment detected - server will not time out after 20 seconds`);
  }
});