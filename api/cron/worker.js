// Worker cron job handler for processing SEO audit jobs
const { default: AuditWorker } = require('../../src/services/worker/index.js');
const { default: logger } = require('../../src/utils/logger.js');

/**
 * Vercel Cron Job to process SEO audit jobs from the queue
 * Runs daily (configured in vercel.json)
 */
module.exports = async function handler(req, res) {
  try {
    logger.info('Worker cron job started');
    
    // Create worker instance
    const worker = new AuditWorker();
    
    // Start the worker
    await worker.start();
    
    // Process one batch of jobs
    await worker.processNextBatch();
    
    // Give some time for jobs to process (up to 50 seconds in a 60-second function)
    const startTime = Date.now();
    const maxWaitTime = 50000; // 50 seconds
    
    // Wait until all jobs are done or timeout
    while (worker.currentJobs.size > 0) {
      // Check if we're approaching the timeout
      if (Date.now() - startTime > maxWaitTime) {
        logger.warn(`Approaching timeout with ${worker.currentJobs.size} jobs still running`);
        break;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Stop the worker gracefully
    await worker.stop();
    
    logger.info('Worker cron job completed');
    
    // Return success response
    res.status(200).json({
      status: 'ok',
      message: 'Worker process completed',
      timestamp: new Date().toISOString(),
      jobsProcessed: worker.currentJobs.size
    });
  } catch (error) {
    logger.error('Error in worker cron job:', error);
    
    // Return error response
    res.status(500).json({
      status: 'error',
      message: 'Worker process failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
