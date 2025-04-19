// Consolidated job endpoint for status and results
const { nanoid } = require('nanoid');

// Helper functions
function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  return false;
}

// Generate mock scores based on job ID
function generateMockScores(jobId) {
  const hash = jobId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const overall = 65 + (hash % 35);
  const meta = 60 + (hash % 40);
  const content = 55 + (hash % 45);
  const technical = 50 + (hash % 50);
  
  return { overall, meta, content, technical };
}

// Main handler
module.exports = async (req, res) => {
  // Handle CORS
  if (handleCors(req, res)) return;
  
  // Check HTTP method
  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'error',
      message: 'Method not allowed'
    });
  }
  
  try {
    // Extract job ID from URL path or query
    const parts = req.url.split('/');
    const pathJobId = parts[parts.length - 2] === 'job' ? parts[parts.length - 1].split('?')[0] : null;
    const queryJobId = req.query.id;
    const jobId = pathJobId || queryJobId;
    
    if (!jobId) {
      return res.status(400).json({
        status: 'error',
        message: 'Job ID is required'
      });
    }
    
    // Check if this is a request for results
    const wantsResults = parts.includes('results') || req.query.results === 'true';
    
    if (wantsResults) {
      // Generate mock scores
      const scores = generateMockScores(jobId);
      
      // Return mock results
      return res.status(200).json({
        status: 'ok',
        jobId: jobId,
        completed: Date.now(),
        results: {
          report: {
            baseUrl: 'https://example.com',
            timestamp: new Date().toISOString(),
            crawlStats: {
              pagesVisited: 15,
              crawlDuration: 45.3
            },
            scores: scores,
            totalIssues: 14,
            issueTypeCounts: {
              'missing-meta': 3,
              'duplicate-content': 2,
              'broken-links': 5,
              'performance': 4
            },
            topIssues: [
              { type: 'broken-links', count: 5 },
              { type: 'performance', count: 4 },
              { type: 'missing-meta', count: 3 }
            ],
            recommendations: [
              {
                type: 'meta-description',
                message: 'Add meta descriptions to pages',
                impact: 'high',
                category: 'meta',
                count: 3,
                affectedPages: 3
              },
              {
                type: 'broken-links',
                message: 'Fix broken links',
                impact: 'high',
                category: 'technical',
                count: 5,
                affectedPages: 2
              }
            ],
            pages: {
              'https://example.com/': {
                url: 'https://example.com/',
                timestamp: new Date().toISOString(),
                scores: {
                  overall: scores.overall - 5,
                  meta: scores.meta - 10,
                  content: scores.content,
                  technical: scores.technical - 3
                },
                issueCount: 4,
                issues: [
                  {
                    type: 'missing-meta-description',
                    message: 'Missing meta description',
                    impact: 'high',
                    category: 'meta'
                  }
                ],
                recommendations: []
              }
            }
          },
          stats: {
            pagesScanned: 15,
            crawlDuration: 45.3,
            analysisTimestamp: new Date().toISOString()
          }
        }
      });
    }
    
    // Return job status
    return res.status(200).json({
      status: 'ok',
      job: {
        id: jobId,
        status: 'completed',
        progress: 100,
        created: Date.now() - 60000,
        updated: Date.now(),
        hasResults: true,
        type: 'site_audit',
        params: {
          url: 'https://example.com',
          options: {}
        }
      }
    });
  } catch (error) {
    console.error('Error getting job data:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get job data',
      error: error.message
    });
  }
};
