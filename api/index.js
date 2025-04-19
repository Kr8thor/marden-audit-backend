// Consolidated /api/index.js with support for all endpoints
import axios from 'axios';
import cheerio from 'cheerio';
import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://smiling-shrimp-21387.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'AVOLAAIjcDFmNzVjNDVjZGM3MGY0NDczODEyMTA0NTAyOGNkMTc5OXAxMA',
});

// Cache TTL in seconds (1 hour default)
const CACHE_TTL = 3600;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin, Cache-Control');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Parse the URL to determine the endpoint
  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname;
  
  console.log(`Request received for path: ${path}, method: ${req.method}`);
  
  // Route to appropriate handler based on the path
  if (path === '/api/health') {
    return handleHealth(req, res);
  } else if (path === '/api/basic-audit') {
    return handleAudit(req, res);
  } else {
    // Default handler for root path
    return handleRoot(req, res);
  }
}

// Health endpoint handler
async function handleHealth(req, res) {
  let redisStatus = {
    status: 'disconnected',
    connected: false
  };

  try {
    // Test Redis connection
    await redis.set('health-check-test', 'ok');
    const testValue = await redis.get('health-check-test');
    
    redisStatus = {
      status: testValue === 'ok' ? 'connected' : 'error',
      connected: testValue === 'ok',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Redis connection error:', error);
    redisStatus = {
      status: 'error',
      connected: false,
      error: error.message
    };
  }

  // Return health status
  return res.status(200).json({
    redis: redisStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}

// Root endpoint handler
async function handleRoot(req, res) {
  return res.status(200).json({
    name: 'MardenSEO Audit API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      basicAudit: '/api/basic-audit'
    },
    documentation: 'Use GET or POST to /api/basic-audit with url parameter to run an SEO audit',
    timestamp: new Date().toISOString()
  });
}

// Audit endpoint handler
async function handleAudit(req, res) {
  try {
    // Extract URL based on request method
    let targetUrl = null;
    
    if (req.method === 'GET') {
      // For GET requests, extract URL from query parameters
      const url = new URL(req.url, `https://${req.headers.host}`);
      targetUrl = url.searchParams.get('url');
      console.log('GET audit request with URL:', targetUrl);
    } else if (req.method === 'POST') {
      // For POST requests, extract URL from request body
      if (req.body && typeof req.body === 'object') {
        targetUrl = req.body.url;
      } else if (req.body && typeof req.body === 'string') {
        try {
          const parsed = JSON.parse(req.body);
          targetUrl = parsed.url;
        } catch (e) {
          console.error('Failed to parse JSON body:', e);
        }
      }
      console.log('POST audit request with URL:', targetUrl);
    } else {
      // Return error for other methods
      return res.status(405).json({
        error: 'Method not allowed',
        message: 'Audit endpoint only accepts GET and POST requests'
      });
    }
    
    // Validate URL parameter
    if (!targetUrl) {
      return res.status(400).json({
        error: 'Missing URL parameter',
        message: 'URL is required',
        method: req.method
      });
    }
    
    // Normalize URL
    let normalizedUrl = targetUrl.trim().toLowerCase();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    
    // Check cache
    const cacheKey = `seo-audit:${normalizedUrl}`;
    let cachedResult = null;
    
    try {
      cachedResult = await redis.get(cacheKey);
      if (cachedResult) {
        console.log(`Cache hit for ${normalizedUrl}`);
        return res.status(200).json({
          ...cachedResult,
          cached: true
        });
      }
    } catch (error) {
      console.error('Cache error:', error);
      // Continue with analysis on cache error
    }
    
    console.log(`Performing audit for ${normalizedUrl}`);
    
    // Simple audit result for testing
    const auditResult = {
      url: normalizedUrl,
      auditDate: new Date().toISOString(),
      overallScore: 75,
      method: req.method,
      cached: false,
      metrics: {
        meta: {
          title: {
            value: "Sample page title",
            length: 17
          },
          metaDescription: {
            value: "Sample meta description for testing",
            length: 32
          },
          score: 80,
          issues: ["Sample issue for testing"]
        }
      },
      summary: {
        text: "This is a sample audit result to verify the endpoint is working with " + req.method,
        issueCount: 1,
        topIssues: [
          {
            severity: "info",
            issue: "This is a test response"
          }
        ]
      }
    };
    
    // Try to cache the result
    try {
      await redis.set(cacheKey, auditResult, { ex: CACHE_TTL });
    } catch (error) {
      console.error('Cache write error:', error);
    }
    
    // Return the result
    return res.status(200).json(auditResult);
  } catch (error) {
    console.error('Error in audit handler:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message || 'An unexpected error occurred',
      method: req.method
    });
  }
}
