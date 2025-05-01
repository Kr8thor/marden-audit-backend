// Redis connection test script
const { redis, getJob, createJob, updateJob, getCachedData, cacheData } = require('./lib/redis.js');

async function testRedisConnection() {
  console.log('Testing Redis connection...');
  
  try {
    // Test basic set/get operations
    const testKey = 'redis:test:' + Date.now();
    console.log(`Setting test key: ${testKey}`);
    
    await redis.set(testKey, 'test-value', { ex: 60 });
    const value = await redis.get(testKey);
    
    if (value === 'test-value') {
      console.log('✅ Basic set/get operations working');
    } else {
      console.error('❌ Basic set/get test failed');
      process.exit(1);
    }
    
    // Test job creation and retrieval
    console.log('Testing job creation/retrieval...');
    
    const jobId = await createJob({
      type: 'test_job',
      params: {
        url: 'https://example.com',
        testParam: 'test-value'
      },
      status: 'queued',
      progress: 0
    });
    
    console.log(`Created job with ID: ${jobId}`);
    
    const job = await getJob(jobId);
    
    if (job && job.type === 'test_job' && job.params.url === 'https://example.com') {
      console.log('✅ Job creation and retrieval working');
    } else {
      console.error('❌ Job creation/retrieval test failed');
      console.log('Retrieved job:', job);
      process.exit(1);
    }
    
    // Test job update
    console.log('Testing job update...');
    
    await updateJob(jobId, {
      status: 'processing',
      progress: 50,
      message: 'Test update'
    });
    
    const updatedJob = await getJob(jobId);
    
    if (updatedJob && updatedJob.status === 'processing' && updatedJob.progress === 50) {
      console.log('✅ Job update working');
    } else {
      console.error('❌ Job update test failed');
      console.log('Updated job:', updatedJob);
      process.exit(1);
    }
    
    // Test caching
    console.log('Testing caching functionality...');
    
    const testData = {
      url: 'https://example.com',
      score: 85,
      timestamp: Date.now()
    };
    
    await cacheData('test', 'example.com', testData, 60);
    const cachedData = await getCachedData('test', 'https://example.com');
    
    if (cachedData && cachedData.score === 85) {
      console.log('✅ Cache set/get working');
    } else {
      console.error('❌ Cache test failed');
      console.log('Retrieved cached data:', cachedData);
      process.exit(1);
    }
    
    console.log('✅ All Redis tests passed!');
    
    // Clean up
    console.log('Cleaning up test data...');
    await redis.del(testKey);
    await redis.del(`job:${jobId}`);
    await redis.del('audit:test:example.com');
    
    console.log('✅ Test complete');
  } catch (error) {
    console.error('❌ Redis test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
testRedisConnection().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
