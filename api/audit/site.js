// Site audit endpoint - Submit an entire website for SEO analysis
const { createJob, getCachedData, cacheData, generateCacheKey, DEFAULT_CACHE_TTL } = require('../lib/redis.js');

// Import the normalizeUrl function from a shared utility file or define it here
function normalizeUrl(url) {
  if (!url) return '';
  
  // Trim whitespace
  let normalizedUrl = url.trim();
  
  // Remove trailing slashes for consistency
  while (normalizedUrl.endsWith('/')) {
    normalizedUrl = normalizedUrl.slice(0, -1);
  }
  
  // Ensure proper protocol
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  
  return normalizedUrl;
}

module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed' 
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
    
    // Get URL and options from request body
    const { url, options } = requestBody;
    
    // Validate URL
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL is required',
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
    
    // Normalize the URL
    const normalizedUrl = normalizeUrl(url);
    console.log(`Normalized URL for site audit: ${normalizedUrl}`);
    
    // Prepare the audit options with defaults for site audit
    const auditOptions = {
      maxPages: 20, // Default to 20 pages for site audit
      depth: 3,     // Default crawl depth
      ...(options || {}) // Override with provided options if any
    };
    
    console.log(`Site audit options:`, auditOptions);
    
    // Check cache first
    const cacheKey = generateCacheKey(normalizedUrl, auditOptions);
    console.log(`Checking cache for site audit: ${cacheKey}`);
    
    const cachedData = await getCachedData('site', normalizedUrl);
    
    if (cachedData) {
      console.log(`Serving cached site audit for ${url}`);
      return res.status(200).json({
        status: 'ok',
        message: 'Site audit results retrieved from cache',
        jobId: cachedData.jobId || 'cached',
        url: url,
        cached: true,
        cachedAt: cachedData.cachedAt,
        results: cachedData
      });
    }
    
    // Create job and add to queue - this will use the site crawler with 20 pages
    console.log(`Creating site audit job for ${normalizedUrl} with max pages: ${auditOptions.maxPages}`);
    
    try {
      const jobId = await createJob({
        type: 'site_audit',
        params: {
          url: normalizedUrl,
          options: auditOptions
        },
      });
      
      // Log success for debugging
      console.log(`Successfully created site audit job: ${jobId}`);
      
      // Return success response
      res.status(202).json({
        status: 'ok',
        message: `Site audit job created for up to ${auditOptions.maxPages} pages`,
        jobId,
        url,
        timestamp: new Date().toISOString()
      });
    } catch (jobError) {
      console.error('Failed to create site audit job:', jobError);
      
      // If job creation fails, perform a single page analysis as fallback
      console.log('Falling back to single page analysis');
      
      // Import the single page analyzer
      const analyzeSeo = require('../index.js').analyzeSeo || 
                         ((url) => Promise.resolve({
                           url,
                           score: 50,
                           status: 'fallback',
                           message: 'Fallback analysis due to job creation failure'
                         }));
      
      // Perform quick analysis of the main URL
      const analysis = await analyzeSeo(normalizedUrl);
      
      // Return as immediate result with note about the fallback
      res.status(200).json({
        status: 'ok',
        message: 'Site audit fell back to single page analysis',
        cached: false,
        url,
        data: {
          ...analysis,
          siteAnalysis: {
            pages: [
              {
                url: normalizedUrl,
                score: analysis.score,
                status: analysis.status,
                pageAnalysis: analysis.pageAnalysis || {},
                timestamp: new Date().toISOString()
              }
            ],
            summary: {
              totalPages: 1,
              averageScore: analysis.score
            }
          }
        },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    // Handle errors
    console.error('Error creating site audit job:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to create site audit job',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}