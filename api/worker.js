// Worker endpoint for processing queued jobs
// This file is called by Vercel cron job every minute

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  try {
    // Get Redis client
    const { redis } = require('./lib/redis.js');
    
    // Get queue configuration
    const queueName = process.env.QUEUE_NAME || 'marden_audit_queue';
    const processingQueueName = process.env.PROCESSING_QUEUE_NAME || 'marden_audit_processing';
    const jobPrefix = process.env.JOB_PREFIX || 'job:';
    
    console.log(`Worker started - checking queue: ${queueName}`);
    
    // Process a batch of jobs
    const batchSize = 3; // Process 3 jobs at a time
    let processedCount = 0;
    
    // Start processing batch
    for (let i = 0; i < batchSize; i++) {
      // Move a job from the queue to the processing queue
      const jobId = await redis.lpop(queueName);
      
      if (!jobId) {
        console.log('No more jobs in queue');
        break;
      }
      
      console.log(`Processing job: ${jobId}`);
      
      // Get the job data
      const jobKey = `${jobPrefix}${jobId}`;
      const job = await redis.get(jobKey);
      
      if (!job) {
        console.log(`Job ${jobId} not found`);
        continue;
      }
      
      // Update job status
      const updatedJob = {
        ...job,
        status: 'processing',
        updated: Date.now(),
      };
      
      await redis.set(jobKey, updatedJob);
      await redis.rpush(processingQueueName, jobId);
      
      // Process the job (mock processing for now)
      // In a real implementation, this would call appropriate analyzers
      
      // Generate mock results
      const mockResults = {
        url: job.params?.url || 'https://example.com',
        score: Math.floor(Math.random() * 100),
        issuesFound: Math.floor(Math.random() * 20),
        opportunities: Math.floor(Math.random() * 10),
        performanceMetrics: {
          lcp: {
            value: (Math.random() * 5).toFixed(1),
            unit: 's',
            score: Math.floor(Math.random() * 100),
          },
          cls: {
            value: (Math.random() * 0.5).toFixed(2),
            score: Math.floor(Math.random() * 100),
          },
          fid: {
            value: Math.floor(Math.random() * 300),
            unit: 'ms',
            score: Math.floor(Math.random() * 100),
          },
        },
        topIssues: [
          {
            severity: 'critical',
            description: 'Missing meta descriptions on multiple pages',
          },
          {
            severity: 'warning',
            description: 'Images without alt text',
          },
          {
            severity: 'info',
            description: 'Consider adding structured data',
          },
        ],
      };
      
      // Update job with results
      const completedJob = {
        ...updatedJob,
        status: 'completed',
        results: mockResults,
        updated: Date.now(),
        completed: Date.now(),
      };
      
      await redis.set(jobKey, completedJob);
      
      // Remove job from processing queue
      await redis.lrem(processingQueueName, 0, jobId);
      
      processedCount++;
    }
    
    // Return success response
    res.status(200).json({
      status: 'ok',
      message: `Worker processed ${processedCount} jobs`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Worker error:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Worker failed to process jobs',
      error: error.message,
    });
  }
};