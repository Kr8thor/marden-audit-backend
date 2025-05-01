// Site audit endpoint for API v2
const { createJob, normalizeUrl, getCachedData, cacheData, DEFAULT_CACHE_TTL } = require('../../lib/redis.js');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin, Cache-Control');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Extract request body
    let requestBody = req.body;
    
    // Parse body if it's a string
    if (typeof requestBody === 'string') {
      try {
        requestBody = JSON.parse(requestBody);
      } catch (e) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Invalid JSON in request body',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Get URL from request body
    const { url, options = {} } = requestBody;
    
    if (!url) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'URL is required',
        timestamp: new Date().toISOString()
      });
    }

    // Parse options with defaults
    const auditOptions = {
      maxPages: parseInt(options.maxPages) || 10,
      crawlDepth: parseInt(options.crawlDepth) || 2,
      ...options
    };
    
    // Validate URL format
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    try {
      new URL(normalizedUrl);
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid URL provided',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check cache first
    const urlKey = normalizeUrl(normalizedUrl);
    const cacheKey = `${urlKey}:max${auditOptions.maxPages}:depth${auditOptions.crawlDepth}`;
    const cachedData = await getCachedData('site', cacheKey);
    
    if (cachedData) {
      console.log(`Serving cached site audit for ${url}`);
      return res.status(200).json({
        status: 'ok',
        message: 'Site audit results retrieved from cache',
        jobId: cachedData.jobId || 'cached',
        url: normalizedUrl,
        options: auditOptions,
        cached: true,
        cachedAt: cachedData.cachedAt,
        timestamp: new Date().toISOString(),
        data: cachedData
      });
    }
    
    // Create a job ID
    const jobId = await createJob({
      type: 'site_audit',
      params: {
        url: normalizedUrl,
        options: auditOptions,
      },
      status: 'queued',
      progress: 0,
      createdAt: Date.now()
    });
    
    // Return job ID to client
    return res.status(202).json({
      status: 'ok',
      message: 'Site audit job created',
      jobId,
      url: normalizedUrl,
      options: auditOptions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating site audit job:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create site audit job',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};