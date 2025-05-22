/**
 * Simple test handler to check if basic functionality works
 */
async function handleSeoAnalyzeSimple(req, res) {
  try {
    // Extract URL from request
    let url = '';
    
    if (req.method === 'POST') {
      url = req.body?.url;
    } else if (req.method === 'GET') {
      url = req.query?.url;
    }
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL parameter is required',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`Simple SEO analysis for: ${url}`);
    
    // Return a basic response to test if the handler works
    return res.status(200).json({
      status: 'ok',
      message: 'Simple SEO analysis test completed',
      url: url,
      cached: false,
      timestamp: new Date().toISOString(),
      data: {
        url: url,
        score: 85,
        status: 'good',
        criticalIssuesCount: 0,
        totalIssuesCount: 2,
        pageData: {
          title: {
            text: 'Test Analysis Result',
            length: 21
          },
          metaDescription: {
            text: 'This is a test analysis to verify the API is working',
            length: 52
          }
        },
        categories: {
          metadata: { score: 90, issues: [] },
          content: { score: 80, issues: [] },
          technical: { score: 85, issues: [] }
        },
        analyzedAt: new Date().toISOString(),
        analyzedWith: 'simple-test-handler'
      }
    });
    
  } catch (error) {
    console.error('Simple SEO analysis error:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Simple SEO analysis failed',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      timestamp: new Date().toISOString()
    });
  }
}