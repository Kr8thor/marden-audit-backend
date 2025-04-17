// Consolidated API endpoints
module.exports = (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get the path from the URL
  const path = req.url.split('/').pop();

  // Handle different endpoints
  if (path === 'debug') {
    return res.status(200).json({
      status: 'ok',
      message: 'Debug endpoint working'
    });
  }

  if (path === 'hello') {
    return res.status(200).json({
      message: 'Hello, world!'
    });
  }

  if (path === 'simple-audit') {
    try {
      let url = req.body?.url || req.query?.url;
      
      if (!url) {
        return res.status(400).json({ error: 'URL required' });
      }
      
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
      
      const score = Math.floor(Math.random() * 35) + 60;
      
      return res.status(200).json({
        url: url,
        score: score,
        issues: [
          { type: 'error', description: 'Missing meta description' },
          { type: 'warning', description: 'Images without alt text' }
        ]
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(404).json({ error: 'Endpoint not found' });
};