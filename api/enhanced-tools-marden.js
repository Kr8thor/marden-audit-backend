// Import necessary modules
const fetch = require('node-fetch');
const normalizeUrl = require('normalize-url');
const redis = require('./lib/redis.optimized');
const mobileFriendlyMarden = require('./mobile-friendly-marden');
const schemaValidatorMarden = require('./schema-validator-marden');
const crawl4aiMarden = require('./crawl4ai-marden');

/**
 * Handle enhanced SEO analysis endpoint
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 */
async function handle(req, res) {
  try {
    // Extract request parameters
    let url;
    let options = {};
    
    if (req.method === 'POST') {
      url = req.body.url;
      options = req.body.options || {};
    } else {
      url = req.query.url;
      
      // Parse options from query parameters
      if (req.query.mobileAnalysis) {
        options.mobileAnalysis = req.query.mobileAnalysis === 'true';
      }
      
      if (req.query.schemaAnalysis) {
        options.schemaAnalysis = req.query.schemaAnalysis === 'true';
      }
      
      if (req.query.siteCrawl) {
        options.siteCrawl = req.query.siteCrawl === 'true';
      }
    }
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Normalize URL
    url = normalizeUrl(url);
    
    // Set default options
    options = options || {};
    const mobileAnalysis = options.mobileAnalysis !== false;
    const schemaAnalysis = options.schemaAnalysis !== false;
    const siteCrawl = options.siteCrawl === true;
    
    // Generate cache key
    const optionsKey = `${mobileAnalysis ? 'm' : ''}${schemaAnalysis ? 's' : ''}${siteCrawl ? 'c' : ''}`;
    const cacheKey = `enhanced-seo:${optionsKey}:${url}`;
    
    // Check cache
    let cachedResult = null;
    if (redis.isRedisConfigured) {
      try {
        cachedResult = await redis.getCache(cacheKey);
        
        if (cachedResult) {
          console.log(`Cache hit for enhanced analysis: ${url}`);
          return res.status(200).json({
            status: 'ok',
            message: 'Enhanced SEO analysis retrieved from cache',
            url,
            cached: true,
            cachedAt: cachedResult.timestamp,
            timestamp: new Date().toISOString(),
            data: cachedResult.data
          });
        }
      } catch (cacheError) {
        console.error('Error checking cache:', cacheError);
      }
    }
    
    // Start analysis
    console.log(`Starting enhanced analysis for ${url} with options:`, options);
    
    // Initialize result object
    const result = {
      url,
      analysisType: siteCrawl ? 'site' : 'page',
      timestamp: new Date().toISOString(),
      components: {}
    };
    
    // Perform site crawl if requested
    if (siteCrawl && crawl4aiMarden) {
      console.log(`Performing site crawl for ${url}`);
      try {
        const crawlResult = await crawl4aiMarden.crawlAndAnalyzeSite(url, {
          maxPages: options.maxPages || 10,
          maxDepth: options.maxDepth || 2,
          respectRobots: options.respectRobots !== false
        });
        
        result.components.siteCrawl = crawlResult;
        
        // Use the base SEO score from the crawl
        result.score = crawlResult.siteScore || 0;
        result.status = crawlResult.siteStatus || 'unknown';
        
      } catch (crawlError) {
        console.error(`Site crawl failed: ${crawlError.message}`);
        result.components.siteCrawl = {
          error: `Site crawl failed: ${crawlError.message}`
        };
      }
    } else {
      // Perform single page analysis
      console.log(`Performing single page analysis for ${url}`);
      
      // Fetch HTML first so we can reuse it across analyses
      let html = null;
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'MardenSEO-Audit/1.0 (https://audit.mardenseo.com)'
          }
        });
        html = await response.text();
      } catch (fetchError) {
        console.error(`Failed to fetch ${url}: ${fetchError.message}`);
        return res.status(200).json({
          status: 'error',
          message: `Failed to fetch URL: ${fetchError.message}`,
          url,
          timestamp: new Date().toISOString()
        });
      }
      
      // Perform mobile-friendliness analysis if enabled
      if (mobileAnalysis && mobileFriendlyMarden) {
        console.log(`Analyzing mobile-friendliness for ${url}`);
        try {
          const mobileResult = await mobileFriendlyMarden.analyzeMobileFriendliness(url, html);
          result.components.mobileFriendliness = mobileResult.mobileFriendliness;
        } catch (mobileError) {
          console.error(`Mobile analysis failed: ${mobileError.message}`);
          result.components.mobileFriendliness = {
            error: `Mobile analysis failed: ${mobileError.message}`
          };
        }
      }
      
      // Perform schema analysis if enabled
      if (schemaAnalysis && schemaValidatorMarden) {
        console.log(`Analyzing structured data for ${url}`);
        try {
          const schemaResult = await schemaValidatorMarden.analyzeStructuredData(url, html);
          result.components.structuredData = schemaResult.structuredData;
        } catch (schemaError) {
          console.error(`Schema analysis failed: ${schemaError.message}`);
          result.components.structuredData = {
            error: `Schema analysis failed: ${schemaError.message}`
          };
        }
      }
      
      // Calculate overall score based on available components
      let totalScore = 0;
      let componentCount = 0;
      
      if (result.components.mobileFriendliness && result.components.mobileFriendliness.score) {
        totalScore += result.components.mobileFriendliness.score;
        componentCount++;
      }
      
      if (result.components.structuredData && result.components.structuredData.status === 'good') {
        totalScore += 90;
        componentCount++;
      } else if (result.components.structuredData && result.components.structuredData.status === 'warning') {
        totalScore += 70;
        componentCount++;
      } else if (result.components.structuredData && result.components.structuredData.status === 'missing') {
        totalScore += 50;
        componentCount++;
      }
      
      // Set default score if no components provided data
      if (componentCount === 0) {
        result.score = 50;
        result.status = 'unknown';
      } else {
        result.score = Math.round(totalScore / componentCount);
        
        // Determine overall status
        if (result.score >= 80) {
          result.status = 'good';
        } else if (result.score >= 50) {
          result.status = 'needs_improvement';
        } else {
          result.status = 'poor';
        }
      }
    }
    
    // Collect all recommendations
    const recommendations = [];
    
    // Add recommendations from mobile analysis
    if (result.components.mobileFriendliness && result.components.mobileFriendliness.recommendations) {
      recommendations.push(...result.components.mobileFriendliness.recommendations);
    }
    
    // Add recommendations from schema analysis
    if (result.components.structuredData && result.components.structuredData.recommendations) {
      recommendations.push(...result.components.structuredData.recommendations);
    }
    
    // Add recommendations from site crawl
    if (result.components.siteCrawl && result.components.siteCrawl.commonIssues) {
      result.components.siteCrawl.commonIssues.forEach(issue => {
        if (issue.recommendation) {
          recommendations.push(issue.recommendation);
        }
      });
    }
    
    // Add recommendations to result
    result.recommendations = [...new Set(recommendations)]; // Remove duplicates
    
    // Cache the result
    if (redis.isRedisConfigured) {
      try {
        await redis.setCache(cacheKey, {
          data: result,
          timestamp: new Date().toISOString()
        }, 86400); // 24 hour cache
      } catch (cacheError) {
        console.error('Error caching result:', cacheError);
      }
    }
    
    // Return result
    return res.status(200).json({
      status: 'ok',
      message: 'Enhanced SEO analysis completed',
      url,
      cached: false,
      timestamp: new Date().toISOString(),
      data: result
    });
    
  } catch (error) {
    console.error('Error in enhanced analysis:', error);
    
    return res.status(500).json({
      status: 'error',
      message: `Analysis failed: ${error.message}`,
      url: req.body?.url,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  handle
};