// Storage utilities for serverless functions
import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Job prefixes and keys
const JOB_PREFIX = 'job:';
const QUEUE_KEY = 'audit:queue';
const PROCESSING_QUEUE_KEY = 'audit:processing';

/**
 * Get a job by ID
 */
export async function getJob(jobId) {
  try {
    const jobKey = `${JOB_PREFIX}${jobId}`;
    return await redis.get(jobKey);
  } catch (error) {
    console.error(`Error getting job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Create a new job
 */
export async function createJob(jobData) {
  try {
    const jobId = jobData.id;
    const jobKey = `${JOB_PREFIX}${jobId}`;
    
    // Save the job data
    await redis.set(jobKey, jobData);
    
    // Add to queue
    await redis.rpush(QUEUE_KEY, jobId);
    
    return jobId;
  } catch (error) {
    console.error('Error creating job:', error);
    throw error;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  try {
    const queueLength = await redis.llen(QUEUE_KEY);
    const processingLength = await redis.llen(PROCESSING_QUEUE_KEY);
    
    return {
      queue: {
        waiting: queueLength,
        processing: processingLength,
        total: queueLength + processingLength,
      }
    };
  } catch (error) {
    console.error('Error getting queue stats:', error);
    throw error;
  }
}
