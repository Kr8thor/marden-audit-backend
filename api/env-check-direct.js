// Direct environment variables checker endpoint
module.exports = (req, res) => {
  // Check environment variables directly
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  res.status(200).json({
    status: 'info',
    message: 'Environment variables check',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    variables: {
      UPSTASH_REDIS_REST_URL: redisUrl ? `Set (starts with: ${redisUrl.substring(0, 8)}...)` : 'Missing',
      UPSTASH_REDIS_REST_TOKEN: redisToken ? `Set (starts with: ${redisToken.substring(0, 3)}...)` : 'Missing'
    }
  });
};
