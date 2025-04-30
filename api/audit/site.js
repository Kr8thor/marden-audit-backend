// Site audit endpoint - Submit an entire website for SEO analysis
const { createJob } = require('../lib/redis.js');

module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed' 
    });
  }

  try {
    const { url, options } = req.body;
    
    // Validate URL
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL is required',
      });
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid URL provided',
      });
    }
    
    // Create job and add to queue
    const jobId = await createJob({
      type: 'site_audit',
      params: {
        url,
        options: options || {},
      },
    });
    
    // Return success response
    res.status(202).json({
      status: 'ok',
      message: 'Site audit job created',
      jobId,
      url,
    });
  } catch (error) {
    // Handle errors
    console.error('Error creating site audit job:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to create site audit job',
      error: error.message,
    });
  }
}
