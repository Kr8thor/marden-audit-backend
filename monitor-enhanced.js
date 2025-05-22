/**
 * Marden SEO Audit Tool - Enhanced Monitoring
 * 
 * This script provides monitoring and statistics for the enhanced features
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const MONITOR_INTERVAL = 60 * 1000; // 1 minute
const ALERT_THRESHOLDS = {
  errorRate: 0.1, // 10% error rate
  responseTime: 3000, // 3 seconds
  memoryUsage: 200 * 1024 * 1024 // 200MB
};

// Global statistics
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  cacheHits: 0,
  averageResponseTime: 0,
  endpoints: {
    '/health': { hits: 0, errors: 0, avgTime: 0 },
    '/seo-analyze': { hits: 0, errors: 0, avgTime: 0 },
    '/schema-analyze': { hits: 0, errors: 0, avgTime: 0 },
    '/mobile-analyze': { hits: 0, errors: 0, avgTime: 0 },
    '/enhanced-seo-analyze': { hits: 0, errors: 0, avgTime: 0 }
  },
  memory: {
    latest: {
      rss: 0,
      heapUsed: 0,
      heapTotal: 0
    },
    peak: {
      rss: 0,
      heapUsed: 0,
      heapTotal: 0
    }
  },
  alerts: []
};

/**
 * Check the health endpoint and update memory stats
 */
async function checkHealth() {
  const startTime = Date.now();
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Update endpoint stats
    stats.endpoints['/health'].hits++;
    stats.endpoints['/health'].avgTime = 
      (stats.endpoints['/health'].avgTime * (stats.endpoints['/health'].hits - 1) + responseTime) / 
      stats.endpoints['/health'].hits;
    
    // Update memory stats
    if (response.data.memory) {
      // Convert memory values from string to number (MB to bytes)
      const rss = parseInt(response.data.memory.rss) * 1024 * 1024;
      const heapUsed = parseInt(response.data.memory.heapUsed) * 1024 * 1024;
      const heapTotal = parseInt(response.data.memory.heapTotal) * 1024 * 1024;
      
      // Update latest memory values
      stats.memory.latest = {
        rss,
        heapUsed,
        heapTotal
      };
      
      // Update peak memory values
      stats.memory.peak.rss = Math.max(stats.memory.peak.rss, rss);
      stats.memory.peak.heapUsed = Math.max(stats.memory.peak.heapUsed, heapUsed);
      stats.memory.peak.heapTotal = Math.max(stats.memory.peak.heapTotal, heapTotal);
      
      // Check for memory alerts
      if (heapUsed > ALERT_THRESHOLDS.memoryUsage) {
        addAlert('memory', `Memory usage exceeded threshold: ${formatBytes(heapUsed)}`);
      }
    }
    
    // Check Redis status
    if (response.data.components && response.data.components.redis) {
      if (response.data.components.redis.status !== 'ok') {
        addAlert('redis', `Redis is not healthy: ${response.data.components.redis.message}`);
      }
    }
    
    // Check concurrency
    if (response.data.concurrency) {
      if (response.data.concurrency.pendingRequests > 5) {
        addAlert('concurrency', `High number of pending requests: ${response.data.concurrency.pendingRequests}`);
      }
    }
    
    return response.data;
  } catch (error) {
    stats.endpoints['/health'].errors++;
    addAlert('health', `Health check failed: ${error.message}`);
    return null;
  }
}

/**
 * Add a new alert with timestamp
 */
function addAlert(type, message) {
  stats.alerts.push({
    type,
    message,
    timestamp: new Date().toISOString()
  });
  
  // Keep only recent 100 alerts
  if (stats.alerts.length > 100) {
    stats.alerts.shift();
  }
  
  // Log alert
  console.error(`[ALERT] ${type}: ${message}`);
}

/**
 * Format bytes to readable format
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Display current statistics
 */
function displayStats() {
  console.clear();
  console.log('=== Marden SEO Audit Tool - Enhanced Monitoring ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log('');
  
  // Request stats
  console.log('=== Request Statistics ===');
  const errorRate = stats.totalRequests ? (stats.failedRequests / stats.totalRequests) : 0;
  console.log(`Total Requests: ${stats.totalRequests}`);
  console.log(`Successful: ${stats.successfulRequests} (${((1 - errorRate) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${stats.failedRequests} (${(errorRate * 100).toFixed(1)}%)`);
  console.log(`Cache Hits: ${stats.cacheHits} (${stats.totalRequests ? ((stats.cacheHits / stats.totalRequests) * 100).toFixed(1) : 0}%)`);
  console.log(`Average Response Time: ${stats.averageResponseTime.toFixed(0)}ms`);
  console.log('');
  
  // Endpoint stats
  console.log('=== Endpoint Statistics ===');
  for (const [endpoint, data] of Object.entries(stats.endpoints)) {
    console.log(`${endpoint}:`);
    console.log(`  Hits: ${data.hits}`);
    console.log(`  Errors: ${data.errors} (${data.hits ? ((data.errors / data.hits) * 100).toFixed(1) : 0}%)`);
    console.log(`  Avg Response Time: ${data.avgTime.toFixed(0)}ms`);
  }
  console.log('');
  
  // Memory stats
  console.log('=== Memory Statistics ===');
  console.log('Current:');
  console.log(`  RSS: ${formatBytes(stats.memory.latest.rss)}`);
  console.log(`  Heap Used: ${formatBytes(stats.memory.latest.heapUsed)}`);
  console.log(`  Heap Total: ${formatBytes(stats.memory.latest.heapTotal)}`);
  console.log('Peak:');
  console.log(`  RSS: ${formatBytes(stats.memory.peak.rss)}`);
  console.log(`  Heap Used: ${formatBytes(stats.memory.peak.heapUsed)}`);
  console.log(`  Heap Total: ${formatBytes(stats.memory.peak.heapTotal)}`);
  console.log('');
  
  // Recent alerts
  console.log('=== Recent Alerts ===');
  if (stats.alerts.length === 0) {
    console.log('No alerts');
  } else {
    const recentAlerts = stats.alerts.slice(-5);
    for (const alert of recentAlerts) {
      console.log(`[${alert.timestamp}] ${alert.type}: ${alert.message}`);
    }
  }
  console.log('');
}

/**
 * Main monitoring loop
 */
async function startMonitoring() {
  console.log('Starting Marden SEO Audit Tool enhanced monitoring...');
  
  setInterval(async () => {
    await checkHealth();
    displayStats();
  }, MONITOR_INTERVAL);
  
  // Initial check
  await checkHealth();
  displayStats();
}

// Run monitoring when called directly
if (require.main === module) {
  startMonitoring().catch(error => {
    console.error('Monitoring failed:', error);
    process.exit(1);
  });
}

module.exports = {
  startMonitoring,
  stats,
  addAlert
};