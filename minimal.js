// Absolute minimal server to break the Railway deployment loop
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Just handle basic routes
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Minimal server is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Minimal server is running in emergency mode',
    endpoints: ['/health'],
    timestamp: new Date().toISOString()
  });
});

// Catch all other routes
app.use('*', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Service running in emergency minimal mode',
    timestamp: new Date().toISOString()
  });
});

// Start server with basic error handling
const server = app.listen(PORT, () => {
  console.log(`Minimal emergency server running on port ${PORT}`);
});

// Handle errors to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  // Don't exit
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
  // Don't exit
});
