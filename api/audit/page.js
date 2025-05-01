// Page audit endpoint - Submit a single page for SEO analysis
const { createJob, normalizeUrl, getCachedData, cacheData, DEFAULT_CACHE_TTL } = require('../lib/redis.js');

module.exports = async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed' 
    });
  }

  try {
    // Get URL from request body
    const { url, options } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'URL is required' 
      });
    }

    // Validate URL format
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid URL provided',
      });
    }
    
    // Check cache first as per Cache-First Strategy (requirement #4)
    const normalizedUrl = normalizeUrl(url);
    const cachedData = await getCachedData('page', normalizedUrl);
    
    if (cachedData) {
      console.log(`Serving cached page audit for ${url}`);
      return res.status(200).json({
        status: 'ok',
        message: 'Page audit results retrieved from cache',
        jobId: cachedData.jobId || 'cached',
        url: url,
        cached: true,
        cachedAt: cachedData.cachedAt,
        results: cachedData
      });
    }
    
    // Create a job ID
    const jobId = await createJob({
      type: 'page_audit',
      params: {
        url: normalizedUrl,
        options: options || {},
      },
    });
    
    // Return job ID to client
    return res.status(202).json({
      status: 'ok',
      message: 'Page audit job created',
      jobId,
      url,
    });
  } catch (error) {
    console.error('Error creating page audit job:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create page audit job',
      error: error.message
    });
  }
}