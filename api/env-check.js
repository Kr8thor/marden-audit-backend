// Environment variables checker endpoint
module.exports = (req, res) => {
  // Check environment variables
  const envVars = {
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? 'Set' : 'Missing',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? 'Set' : 'Missing',
    NODE_ENV: process.env.NODE_ENV || 'Not set (will default to development)'
  };
  
  // Calculate status based on required variables
  const allRequiredVarsPresent = 
    process.env.UPSTASH_REDIS_REST_URL && 
    process.env.UPSTASH_REDIS_REST_TOKEN;
  
  res.status(200).json({
    status: allRequiredVarsPresent ? 'ok' : 'warning',
    message: allRequiredVarsPresent 
      ? 'All required environment variables are set' 
      : 'Some required environment variables are missing',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    variables: envVars
  });
};
