// Get job status endpoint
import { Redis } from '@upstash/redis';
// We need to require instead of using import since we're mixing module systems
const redisUtil = require('../lib/redis.js');

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
    
    // Return job details (without potentially large results data)
    const { results, ...jobInfo } = job;
    
    return res.status(200).json({
      status: 'ok',
      job: {
        ...jobInfo,
        hasResults: !!results
      }
    });
  } catch (error) {
    console.error(`Error getting job:`, error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get job details',
      error: error.message
    });
  }
}
