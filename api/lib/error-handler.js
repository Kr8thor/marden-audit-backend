// Error handling middleware for Marden SEO Audit API
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (err) {
    console.error('Could not create logs directory:', err);
  }
}

// Log file paths
const errorLogPath = path.join(logsDir, 'error.log');
const accessLogPath = path.join(logsDir, 'access.log');

/**
 * Write error to log file
 * @param {Error} error - The error to log
 * @param {Object} details - Additional details about the request
 */
function logError(error, details = {}) {
  const timestamp = new Date().toISOString();
  
  const logEntry = {
    timestamp,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    },
    details
  };
  
  // Log to console
  console.error(`[${timestamp}] ERROR:`, error.message, details);
  
  // Also log to file if possible
  try {
    fs.appendFileSync(
      errorLogPath,
      JSON.stringify(logEntry) + '\n',
      { flag: 'a' }
    );
  } catch (err) {
    console.error('Could not write to error log file:', err);
  }
}

/**
 * Log API access
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function logAccess(req, res) {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path || req.url;
  const query = req.query ? JSON.stringify(req.query) : '';
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || '';
  
  const logEntry = {
    timestamp,
    method,
    path,
    query,
    ip,
    userAgent,
    status: res.statusCode
  };
  
  // Log to console in dev mode
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${timestamp}] ${method} ${path} - ${res.statusCode}`);
  }
  
  // Log to file if possible
  try {
    fs.appendFileSync(
      accessLogPath,
      JSON.stringify(logEntry) + '\n',
      { flag: 'a' }
    );
  } catch (err) {
    console.error('Could not write to access log file:', err);
  }
}

/**
 * Express middleware to handle errors
 */
function errorHandler(err, req, res, next) {
  // Log the error
  logError(err, {
    url: req.url,
    method: req.method,
    query: req.query,
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent']
  });
  
  // Don't expose stack traces in production
  const errorDetails = process.env.NODE_ENV === 'production' 
    ? { message: 'An internal error occurred' }
    : { message: err.message, stack: err.stack };
  
  // Send error response if headers not sent yet
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      status: 'error',
      ...errorDetails,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  errorHandler,
  logError,
  logAccess
};