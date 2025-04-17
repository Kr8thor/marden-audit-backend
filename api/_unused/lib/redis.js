// Redis connection for serverless functions
const { Redis } = require('@upstash/redis');

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Key prefixes
const keys = {
  jobPrefix: 'job:',
  queueKey: 'audit:queue',
  processingQueueKey: 'audit:processing',
};

// Utility functions for job queue
async function getJob(jobId) {
  const jobKey = `${keys.jobPrefix}${jobId}`;
  return await redis.get(jobKey);
}

async function createJob(jobData) {
  // Generate a timestamp-based ID if none provided
  const jobId = jobData.id || `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const jobKey = `${keys.jobPrefix}${jobId}`;
  
  // Create job object
  const job = {
    id: jobId,
    status: 'queued',
    progress: 0,
    created: Date.now(),
    updated: Date.now(),
    ...jobData,
  };
  
  // Save the job data
  await redis.set(jobKey, job);
  
  // Add the job ID to the queue
  await redis.rpush(keys.queueKey, jobId);
  
  return jobId;
}

module.exports = {
  redis,
  keys,
  getJob,
  createJob
};
