/**
 * Enhanced SEO Analysis Handler
 * Uses the new robust analysis engine
 */

const { performSeoAnalysis } = require('./enhanced-analysis-engine');
const redis = require('./lib/redis.optimized');

// In-memory cache for quick response
const memoryCache = new Map();
const MEMORY_CACHE_MAX_SIZE = 100;
const MEMORY_CACHE_TTL = 3600000; // 1 hour in milliseconds

function normalizeUrl(url) {
  if (!url) return '';
  
  let normalized = url.trim();
  
  // Remove trailing slashes
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  
  // Ensure proper protocol
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  
  return normalized;
}

async function handleEnhancedSeoAnalyze(req, res) {
  const startTime = Date.now();
  
  try {
    // Extract URL from request
    let url = '';
    if (req.method === 'POST') {
      url = req.body.url;
    } else {
      url = req.query.url;
    }
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL parameter is required',
        timestamp: new Date().toISOString()
      });
    }
    
    const normalizedUrl = normalizeUrl(url);
    console.log(`🚀 Enhanced SEO analysis requested for: ${normalizedUrl}`);
    
    // Generate cache key
    const cacheKey = `enhanced-seo-audit:${normalizedUrl}`;
    
    // Check memory cache first
    if (memoryCache.has(cacheKey)) {
      const cached = memoryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
        console.log(`💾 Memory cache hit for: ${normalizedUrl}`);
        return res.status(200).json({
          status: 'ok',
          message: 'SEO analysis retrieved from memory cache',
          url: normalizedUrl,
          cached: true,
          cachedAt: new Date(cached.timestamp).toISOString(),
          timestamp: new Date().toISOString(),
          data: cached.data
        });
      } else {
        memoryCache.delete(cacheKey);
      }
    }
    
    // Check Redis cache
    let cachedResult = null;
    if (redis.isRedisConfigured) {
      try {
        cachedResult = await redis.getCache(cacheKey);
        if (cachedResult) {
          console.log(`🗄️ Redis cache hit for: ${normalizedUrl}`);
          
          // Update memory cache
          if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
            const oldestKey = Array.from(memoryCache.keys())[0];
            memoryCache.delete(oldestKey);
          }
          memoryCache.set(cacheKey, {
            data: cachedResult.data,
            timestamp: Date.now()
          });
          
          return res.status(200).json({
            status: 'ok',
            message: 'SEO analysis retrieved from cache',
            url: normalizedUrl,
            cached: true,
            cachedAt: cachedResult.timestamp,
            timestamp: new Date().toISOString(),
            data: cachedResult.data
          });
        }
      } catch (cacheError) {
        console.error('Cache error:', cacheError);
      }
    }
    
    // Perform fresh analysis
    console.log(`🔍 Performing fresh analysis for: ${normalizedUrl}`);
    
    try {
      const analysisResult = await performSeoAnalysis(normalizedUrl);
      
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      analysisResult.metadata.analysisTime = executionTime;
      
      // Cache the result
      const cacheData = {
        data: analysisResult,
        timestamp: new Date().toISOString()
      };
      
      // Cache in Redis
      if (redis.isRedisConfigured) {
        try {
          await redis.setCache(cacheKey, cacheData, 86400); // 24 hours
        } catch (cacheError) {
          console.error('Error caching result:', cacheError);
        }
      }
      
      // Cache in memory
      if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
        const oldestKey = Array.from(memoryCache.keys())[0];
        memoryCache.delete(oldestKey);
      }
      memoryCache.set(cacheKey, {
        data: analysisResult,
        timestamp: Date.now()
      });
      
      console.log(`✅ Fresh analysis completed for ${normalizedUrl} - Score: ${analysisResult.score}`);
      
      return res.status(200).json({
        status: 'ok',
        message: 'SEO analysis completed successfully',
        url: normalizedUrl,
        cached: false,
        timestamp: new Date().toISOString(),
        executionTime: executionTime,
        data: analysisResult
      });
      
    } catch (analysisError) {
      console.error(`❌ Analysis failed for ${normalizedUrl}:`, analysisError.message);
      
      // Return structured error response
      return res.status(200).json({
        status: 'ok',
        message: 'Analysis completed with errors',
        url: normalizedUrl,
        cached: false,
        timestamp: new Date().toISOString(),
        data: {
          url: normalizedUrl,
          score: 0,
          status: 'error',
          error: {
            message: analysisError.message,
            type: 'analysis_error'
          },
          criticalIssuesCount: 1,
          totalIssuesCount: 1,
          categories: {
            metadata: { score: 0, issues: [] },
            content: { score: 0, issues: [] },
            technical: { score: 0, issues: [] },
            userExperience: { score: 0, issues: [] }
          },
          pageData: {
            title: { text: '', length: 0 },
            metaDescription: { text: '', length: 0 },
            headings: { h1Count: 0, h1Texts: [], h2Count: 0, h2Texts: [], h3Count: 0 },
            content: { wordCount: 0, contentLength: 0 },
            links: { internalCount: 0, externalCount: 0, totalCount: 0 },
            images: { total: 0, withoutAlt: 0 },
            technical: { hasCanonical: false, canonicalUrl: '' }
          },
          recommendations: ['Fix the website accessibility issue before running SEO analysis'],
          metadata: {
            analysisTime: Date.now() - startTime,
            htmlSize: '0 KB'
          },
          analyzedAt: new Date().toISOString()
        }
      });
    }
    
  } catch (error) {
    console.error('Handler error:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error during analysis',
      error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  handleEnhancedSeoAnalyze
};