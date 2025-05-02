// Simple Express server for local development
// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const apiHandler = require('./api/index');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all requests
app.use(cors());

// Parse JSON and URL-encoded bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Log environment variables
console.log('Environment variables loaded:');
console.log('- Redis URL:', process.env.UPSTASH_REDIS_REST_URL ? 'Set' : 'Not Set');
console.log('- Redis Token:', process.env.UPSTASH_REDIS_REST_TOKEN ? 'Set' : 'Not Set');

// Pass all requests to our API handler
app.all('*', (req, res) => {
  return apiHandler(req, res);
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`Health check endpoint: http://localhost:${port}/health`);
  console.log(`API endpoint: http://localhost:${port}/seo-analyze`);
});