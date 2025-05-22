/**
 * Enhanced SEO Analyzer - Combines basic analysis with site crawling
 * This provides comprehensive SEO analysis including multi-page insights
 */

const { handleSeoAnalyze } = require('./site-audit');
const handleWorkingSiteCrawl = require('./working-site-crawler');

/**
 * Enhanced SEO Analysis Handler
 * Performs both single-page analysis and optional site crawling
 */
async function handleEnhancedSeoAnalyze(req, res) {
  console.log('🚀 Enhanced SEO analysis request received');
  
  try {
    // Extract parameters
    let url = '';
    let options = {};
    
    if (req.method === 'POST') {
      url = req.body.url;
      options = req.body.options || {};
    } else {
      url = req.query.url;
      options = {
        crawlSite: req.query.crawlSite === 'true',
        maxPages: parseInt(req.query.maxPages) || 3,
        maxDepth: parseInt(req.query.maxDepth) || 1
      };
    }
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL parameter is required',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`🎯 Enhanced analysis for: ${url}`);
    console.log(`📋 Options:`, options);
    
    // Always perform basic analysis first
    const basicAnalysisPromise = new Promise((resolve, reject) => {
      // Create a mock response object to capture the basic analysis
      const mockRes = {
        status: (code) => mockRes,
        json: (data) => {
          resolve(data);
          return mockRes;
        },
        setHeader: () => mockRes,
        header: () => mockRes
      };
      
      // Perform basic analysis
      handleSeoAnalyze(req, mockRes).catch(reject);
    });
    
    try {
      const startTime = Date.now();
      
      // Get basic analysis
      const basicAnalysis = await basicAnalysisPromise;
      console.log('✅ Basic analysis completed');
      
      // Prepare enhanced result
      let enhancedResult = {
        type: 'enhanced',
        url: url,
        timestamp: new Date().toISOString(),
        components: {
          basicAnalysis: basicAnalysis.data || basicAnalysis,
          siteCrawl: null
        },
        summary: {
          overallScore: 0,
          analysisType: 'single-page',
          recommendations: []
        }
      };
      
      // Perform site crawl if requested
      if (options.crawlSite) {
        console.log('🕷️ Performing site crawl...');
        
        const crawlPromise = new Promise((resolve, reject) => {
          const mockCrawlRes = {
            status: (code) => mockCrawlRes,
            json: (data) => {
              resolve(data);
              return mockCrawlRes;
            },
            setHeader: () => mockCrawlRes,
            header: () => mockCrawlRes
          };
          
          // Create crawl request
          const crawlReq = {
            ...req,
            body: {
              url: url,
              options: {
                maxPages: options.maxPages || 3,
                maxDepth: options.maxDepth || 1
              }
            }
          };
          
          handleWorkingSiteCrawl(crawlReq, mockCrawlRes).catch(reject);
        });
        
        try {
          const crawlResult = await crawlPromise;
          enhancedResult.components.siteCrawl = crawlResult.data || crawlResult;
          enhancedResult.summary.analysisType = 'multi-page';
          console.log('✅ Site crawl completed');
        } catch (crawlError) {
          console.error('❌ Site crawl failed:', crawlError.message);
          enhancedResult.components.siteCrawl = {
            error: crawlError.message,
            status: 'failed'
          };
        }
      }
      
      // Calculate overall score
      let overallScore = basicAnalysis.data?.score || 0;
      
      if (enhancedResult.components.siteCrawl && !enhancedResult.components.siteCrawl.error) {
        const siteScore = enhancedResult.components.siteCrawl.crawlStats?.avgScore || 0;
        // Weighted average: 60% single page, 40% site-wide
        overallScore = Math.round(overallScore * 0.6 + siteScore * 0.4);
      }
      
      enhancedResult.summary.overallScore = overallScore;
      
      // Generate enhanced recommendations
      const recommendations = [];
      
      // Add basic recommendations
      if (basicAnalysis.data?.recommendations) {
        recommendations.push(...basicAnalysis.data.recommendations.slice(0, 3));
      }
      
      // Add site-wide recommendations
      if (enhancedResult.components.siteCrawl?.summary?.recommendations) {
        recommendations.push(...enhancedResult.components.siteCrawl.summary.recommendations.slice(0, 3));
      }
      
      enhancedResult.summary.recommendations = recommendations;
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ Enhanced analysis completed in ${totalTime}ms`);
      
      return res.status(200).json({
        status: 'ok',
        message: 'Enhanced SEO analysis completed',
        url: url,
        cached: false,
        timestamp: new Date().toISOString(),
        executionTime: totalTime,
        data: enhancedResult
      });
      
    } catch (analysisError) {
      console.error('❌ Enhanced analysis error:', analysisError.message);
      throw analysisError;
    }
    
  } catch (error) {
    console.error('❌ Enhanced SEO analysis failed:', error.message);
    
    return res.status(500).json({
      status: 'error',
      message: 'Enhanced SEO analysis failed',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = handleEnhancedSeoAnalyze;
