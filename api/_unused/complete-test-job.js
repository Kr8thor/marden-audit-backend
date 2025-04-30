import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get job ID from request body
    const { jobId } = req.body;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    // Get job from Redis
    const jobKey = `job:${jobId}`;
    const jobData = await redis.get(jobKey);
    
    if (!jobData) {
      return res.status(404).json({
        status: 'error',
        message: `Job ${jobId} not found`
      });
    }
    
    // Parse job data
    const job = JSON.parse(jobData);
    
    // Update job with mock results
    const updatedJob = {
      ...job,
      status: 'completed',
      progress: 100,
      completed: Date.now(),
      results: {
        url: job.url,
        timestamp: new Date().toISOString(),
        scores: {
          overall: 85,
          meta: 90,
          content: 80,
          technical: 85
        },
        issues: [
          { type: 'missing_meta_description', impact: 'medium', message: 'Page is missing a meta description' },
          { type: 'images_missing_alt', impact: 'medium', message: '3 images missing alt text' }
        ],
        recommendations: [
          { type: 'missing_meta_description', impact: 'medium', message: 'Add a meta description to the page' },
          { type: 'images_missing_alt', impact: 'medium', message: 'Add descriptive alt text to all images' }
        ]
      }
    };
    
    // Save updated job
    await redis.set(jobKey, JSON.stringify(updatedJob));
    
    return res.status(200).json({
      status: 'ok',
      message: `Job ${jobId} marked as completed with test results`,
      job: updatedJob
    });
  } catch (error) {
    console.error(`Error completing test job:`, error);
    return res.status(500).json({
      error: 'Failed to complete test job',
      message: error.message
    });
  }
}
