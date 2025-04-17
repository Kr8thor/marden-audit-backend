// Get job status endpoint
module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      status: 'error', 
      message: 'Method not allowed' 
    });
  }

  try {
    // Get job ID from URL
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Job ID is required' 
      });
    }

    // For demo purposes, return a completed status
    return res.status(200).json({
      status: 'ok',
      job: {
        id: id,
        status: 'completed',
        progress: 100,
        createdAt: new Date(Date.now() - 60000).toISOString(),
        completedAt: new Date().toISOString(),
        hasResults: true
      }
    });
  } catch (error) {
    console.error(`Error getting job:`, error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get job details',
      error: error.message
    });
  }
};