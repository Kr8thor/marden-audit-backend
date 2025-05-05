// Main application entry point for Railway deployment
const express = require('express');
const cors = require('cors');
const path = require('path');

// Configure safer error handling
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down gracefully...');
  console.error(err.name, err.message, err.stack);
  // Don't exit - let Railway handle restarts
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Continuing operation...');
  console.error(err.name, err.message, err.stack);
  // Don't exit - continue operating
});

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || '3', 10);
const MAX_MEMORY_PERCENT = parseInt(process.env.MAX_MEMORY_PERCENT || '80', 10);

// Safer API loading - continue even if it fails
let apiHandler;
try {
  // Use optimized API with error handling
  apiHandler = require('./api/index.js');
  console.log('API handler loaded successfully');
} catch (err) {
  console.error('Failed to load API handler:', err.message);
  // Provide a fallback that doesn't crash
  apiHandler = (req, res) => {
    res.status(503).json({
      status: 'error',
      message: 'API temporarily unavailable',
      error: 'Internal configuration error'
    });
  };
}

// Set up allowed origins from environment variable
const corsOrigins = process.env.CORS_ORIGIN ? 
  process.env.CORS_ORIGIN.split(',') : 
  ['https://audit.mardenseo.com', 'http://localhost:9090'];

console.log('CORS origins:', corsOrigins);

// Add middleware
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON and URL-encoded bodies
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Add basic logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`${req.method} ${req.url} - Started at ${new Date().toISOString()}`);
  
  // Log after response
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Add memory monitoring
app.use((req, res, next) => {
  const memUsage = process.memoryUsage();
  const memPercent = (memUsage.heapUsed / memUsage.heapTotal * 100).toFixed(1);
  
  if (memUsage.heapUsed / memUsage.heapTotal > MAX_MEMORY_PERCENT / 100) {
    console.warn(`WARNING: Memory usage high (${memPercent}%)`, {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
    });
    
    // Run garbage collection if available (V8 engine only)
    if (global.gc) {
      console.log('Running garbage collection...');
      global.gc();
    }
  }
  next();
});

// Add server status endpoint
app.get('/status', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      usage: `${(memUsage.heapUsed / memUsage.heapTotal * 100).toFixed(1)}%`
    },
    environment: process.env.NODE_ENV || 'development',
    version: '2.1.0-railway',
    concurrency: {
      limit: MAX_CONCURRENCY
    }
  });
});

// Forward all API requests to the optimized handler
app.all('/api/*', (req, res) => {
  try {
    apiHandler(req, res);
  } catch (err) {
    console.error('Error handling API request:', err);
    if (!res.headersSent) {
      res.status(500).json({
        status: 'error',
        message: 'Internal server error during API processing',
        error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
      });
    }
  }
});

// Also accept requests with no /api prefix for backward compatibility
app.all('/health', (req, res) => {
  try {
    // Simple health check that doesn't use the full API handler
    res.status(200).json({
      status: 'ok',
      message: 'Service is running',
      timestamp: new Date().toISOString(),
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB / ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
    });
  } catch (err) {
    console.error('Health check error:', err);
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
});

app.all('/seo-analyze', (req, res) => {
  // Create new URL using current url but with /api prefix
  const originalUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  req.url = '/api/seo-analyze' + (originalUrl.search || '');
  console.log(`Forwarding to: ${req.url}`);
  apiHandler(req, res);
});

app.all('/basic-audit', (req, res) => {
  // Create new URL using current url but with /api prefix
  const originalUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  req.url = '/api/basic-audit' + (originalUrl.search || '');
  console.log(`Forwarding to: ${req.url}`);
  apiHandler(req, res);
});

app.all('/batch-audit', (req, res) => {
  // Create new URL using current url but with /api prefix
  const originalUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  req.url = '/api/batch-audit' + (originalUrl.search || '');
  console.log(`Forwarding to: ${req.url}`);
  apiHandler(req, res);
});

// Add root handler
app.get('/', (req, res) => {
  res.json({
    service: 'Marden SEO Audit API',
    status: 'running',
    endpoints: [
      '/health',
      '/seo-analyze',
      '/basic-audit',
      '/batch-audit'
    ],
    documentation: 'https://github.com/Kr8thor/marden-audit-backend'
  });
});

// Unhandled route middleware
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.url} not found`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 
      'An unexpected error occurred' : 
      err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  
  // Log memory usage on startup
  const memUsage = process.memoryUsage();
  console.log('Initial memory usage:', {
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
  });
  
  // Enable scheduled garbage collection every 30 minutes
  setInterval(() => {
    if (global.gc) {
      console.log('Running scheduled garbage collection...');
      global.gc();
      
      // Log memory after GC
      const memUsageAfter = process.memoryUsage();
      console.log('Memory after GC:', {
        rss: `${Math.round(memUsageAfter.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsageAfter.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsageAfter.heapTotal / 1024 / 1024)}MB`
      });
    }
  }, 30 * 60 * 1000); // 30 minutes
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
