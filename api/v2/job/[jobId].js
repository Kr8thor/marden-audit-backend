// Job status endpoint - Get status of a specific job
const { getJob } = require('../../lib/redis.js');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin, Cache-Control');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Get job ID from URL
    const jobId = req.query.jobId;
    
    if (!jobId) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Job ID is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Get job details
    const job = await getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: `Job with ID ${jobId} not found`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Return job status
    return res.status(200).json({
      status: 'ok',
      message: `Job status retrieved`,
      jobId,
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress || 0,
        createdAt: job.created,
        updatedAt: job.updated,
        url: job.params?.url,
        options: job.params?.options || {}
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error fetching job status:`, error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch job status',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};