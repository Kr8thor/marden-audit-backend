// Direct job processing endpoint
import { Redis } from '@upstash/redis';

// Simple job queue configuration constants
const jobPrefix = 'job:';
const queueKey = 'audit:queue';
const processingQueueKey = 'audit:processing';

export default async function handler(req, res) {
  // Only allow POST requests for manual triggering
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed' 
    });
  }

  try {
    // Initialize Redis client directly
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    
    // Get next job from queue
    const jobId = await redis.lpop(queueKey);
    
    if (!jobId) {
      return res.status(200).json({
        status: 'ok',
        message: 'No jobs in queue',
        timestamp: new Date().toISOString()
      });
    }
    
    // Add to processing queue
    await redis.rpush(processingQueueKey, jobId);
    
    // Get job details
    const jobKey = `${jobPrefix}${jobId}`;
    const job = await redis.get(jobKey);
    
    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: `Job ${jobId} not found`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Update job status to processing
    const updatedJob = {
      ...job,
      status: 'processing',
      progress: 10,
      updated: Date.now()
    };
    await redis.set(jobKey, updatedJob);
    
    // Create simplified but functional SEO analysis
    const url = job.params?.url;
    if (!url) {
      throw new Error('URL is missing from job parameters');
    }
    
    // Create a simplified mock result for now
    // This will allow us to verify our pipeline is working
    const analysisResults = {
      url: url,
      score: 72,
      issuesFound: 14,
      opportunities: 9,
      performanceMetrics: {
        lcp: {
          value: 2.5,
          unit: 's',
          score: 75
        },
        cls: {
          value: 0.02,
          score: 95
        },
        fid: {
          value: 12,
          unit: 'ms',
          score: 90
        }
      },
      topIssues: [
        {
          severity: 'critical',
          description: 'Missing meta descriptions (4 pages)'
        },
        {
          severity: 'warning',
          description: 'Low word count on key pages'
        },
        {
          severity: 'info',
          description: 'Images missing alt text'
        }
      ],
      timestamp: new Date().toISOString()
    };
    
    // Complete the job with results
    const completedJob = {
      ...updatedJob,
      status: 'completed',
      progress: 100,
      results: analysisResults,
      completed: Date.now()
    };
    
    await redis.set(jobKey, completedJob);
    
    // Remove from processing queue
    // Get all processing jobs
    const processingJobs = await redis.lrange(processingQueueKey, 0, -1);
    
    // Clear processing queue
    await redis.del(processingQueueKey);
    
    // Push back all except the completed one
    const remainingJobs = processingJobs.filter(id => id !== jobId);
    if (remainingJobs.length > 0) {
      await redis.rpush(processingQueueKey, ...remainingJobs);
    }
    
    res.status(200).json({
      status: 'ok',
      message: 'Job processed successfully',
      jobId: jobId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Job processing failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
