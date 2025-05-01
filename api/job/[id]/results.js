// Get job results endpoint
import { Redis } from '@upstash/redis';
// We need to require instead of using import since we're mixing module systems
const redisUtil = require('../../lib/redis.js');

// Initialize Redis client (this is a fallback if the utility isn't available)
let redis;
if (!redisUtil.redis) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} else {
  redis = redisUtil.redis;
}

export default async function handler(req, res) {
  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed' 
    });
  }

  try {
    // Get job ID from URL
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Job ID is required' 
      });
    }

    // Get job from Redis
    let job;
    if (redisUtil.getJob) {
      job = await redisUtil.getJob(id);
    } else {
      // Fallback if getJob utility isn't available
      const jobData = await redis.get(`job:${id}`);
      job = jobData ? JSON.parse(jobData) : null;
    }
    
    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: `Job ${id} not found`
      });
    }
    
    // Check if job is completed
    if (job.status !== 'completed') {
      return res.status(400).json({
        status: 'error',
        message: `Job ${id} is not completed (status: ${job.status})`,
        jobStatus: job.status
      });
    }
    
    // Check if results exist
    if (!job.results) {
      return res.status(404).json({
        status: 'error',
        message: `No results found for job ${id}`
      });
    }
    
    return res.status(200).json({
      status: 'ok',
      jobId: id,
      completed: job.completed || job.updated,
      results: job.results
    });
  } catch (error) {
    console.error(`Error getting job results:`, error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get job results',
      error: error.message
    });
  }
}
