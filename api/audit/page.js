const { nanoid } = require('nanoid');
const { redis } = require('../lib/redis.js');

module.exports = async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get URL from request body
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Create a job ID
    const jobId = nanoid();
    
    // Create job data
    const job = {
      id: jobId,
      url,
      status: 'queued',
      created: Date.now(),
      updated: Date.now(),
    };
    
    // Store job in Redis
    await redis.set(`job:${jobId}`, JSON.stringify(job));
    
    // Add job to queue
    await redis.rpush('audit:queue', jobId);
    
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
      error: 'Failed to create page audit job',
      message: error.message
    });
  }
}
