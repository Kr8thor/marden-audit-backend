// Manual endpoint to process jobs
const { default: AuditWorker } = require('../src/services/worker/index.js');
const { default: logger } = require('../src/utils/logger.js');

/**
 * Manual endpoint to process jobs from the queue
 * Can be called via API to manually trigger job processing
 */
module.exports = async function handler(req, res) {
  // Only allow POST requests for manual triggering
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed' 
    });
  }

  try {
    logger.info('Manual job processing started');
    
    // Create worker instance
    const worker = new AuditWorker();
    
    // Start the worker
    await worker.start();
    
    // Process one batch of jobs
    await worker.processNextBatch();
    
    // Give some time for jobs to process
    const startTime = Date.now();
    const maxWaitTime = 45000; // 45 seconds (to stay within function limits)
    
    // Wait until all jobs are done or timeout
    while (worker.currentJobs.size > 0) {
      if (Date.now() - startTime > maxWaitTime) {
        logger.warn(`Approaching timeout with ${worker.currentJobs.size} jobs still running`);
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Stop the worker gracefully
    await worker.stop();
    
    logger.info('Manual job processing completed');
    
    // Return success response
    res.status(200).json({
      status: 'ok',
      message: 'Manual job processing completed',
      timestamp: new Date().toISOString(),
      jobsProcessed: worker.currentJobs.size
    });
  } catch (error) {
    logger.error('Error in manual job processing:', error);
    
    // Return error response
    res.status(500).json({
      status: 'error',
      message: 'Manual job processing failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
