import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get job ID from URL
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    // Get job from Redis
    const jobData = await redis.get(`job:${id}`);
    
    if (!jobData) {
      return res.status(404).json({
        status: 'error',
        message: `Job ${id} not found`
      });
    }
    
    // Parse job data
    const job = JSON.parse(jobData);
    
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
      error: 'Failed to get job details',
      message: error.message
    });
  }
}
