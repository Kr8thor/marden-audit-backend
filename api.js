// Express server wrapper for the API
const express = require('express');
const bodyParser = require('body-parser');
const api = require('./index');

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Main API route
app.all('*', async (req, res) => {
  return api(req, res);
});

// Start server
if (require.main === module) {
  app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
  });
}

// Export app for Vercel
module.exports = app;