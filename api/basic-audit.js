// /api/basic-audit.js
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
  
  // Extract URL based on request method
  let url = null;
  
  if (req.method === 'GET') {
    // For GET requests, extract URL from query parameters
    url = req.query.url;
    console.log('GET request received with URL:', url);
  } else if (req.method === 'POST') {
    // For POST requests, extract URL from request body
    if (req.body && typeof req.body === 'object') {
      url = req.body.url;
    } else if (req.body && typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        url = parsed.url;
      } catch (e) {
        console.error('Failed to parse JSON body:', e);
      }
    }
    console.log('POST request received with URL:', url);
  } else {
    // Reject other methods
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'This endpoint only accepts GET and POST requests'
    });
  }
  
  // Validate URL parameter
  if (!url) {
    return res.status(400).json({
      error: 'Missing URL parameter',
      message: 'URL is required',
      method: req.method
    });
  }
  
  // Normalize URL
  let normalizedUrl = url;
  if (!normalizedUrl.startsWith('http')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }
  
  // Create a simple response with the parsed URL
  try {
    // Create a simple audit result
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
        text: "This is a sample audit result to verify GET method is working",
        issueCount: 1,
        topIssues: [
          {
            severity: "info",
            issue: "This is a test response"
          }
        ]
      }
    };
    
    // Return the result
    return res.status(200).json(auditResult);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message || 'An unexpected error occurred',
      method: req.method
    });
  }
}
