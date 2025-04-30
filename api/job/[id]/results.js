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
      completed: job.completed,
      results: job.results
    });
  } catch (error) {
    console.error(`Error getting job results:`, error);
    return res.status(500).json({
      error: 'Failed to get job results',
      message: error.message
    });
  }
}
