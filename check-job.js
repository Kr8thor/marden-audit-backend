// Script to check the job status
const redis = require('./api/lib/redis');

async function checkJob(jobId) {
  try {
    console.log(`Checking job status for ID: ${jobId}`);
    
    // Check if Redis is configured
    if (!redis.isRedisConfigured) {
      console.log('Redis is not configured. Cannot check job status.');
      return;
    }
    
    // Get job data from Redis
    const jobKey = `job:${jobId}`;
    const jobData = await redis.getCache(jobKey);
    
    if (!jobData) {
      console.log(`No job found with ID: ${jobId}`);
      return;
    }
    
    console.log('Job status:');
    console.log(JSON.stringify(jobData, null, 2));
    
  } catch (error) {
    console.error('Error checking job status:', error);
  }
}

// Get job ID from command line arguments
const jobId = process.argv[2];

if (!jobId) {
  console.log('Please provide a job ID as a command line argument');
  process.exit(1);
}

checkJob(jobId);