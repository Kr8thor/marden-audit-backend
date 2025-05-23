/**
 * Simple Full Site Crawler - Working Implementation
 * This provides basic full site crawling functionality
 */

const axios = require('axios');
const cheerio = require('cheerio');

// Simple URL normalization
function normalizeUrl(url) {
  if (!url) return '';
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

/**
 * Analyze a single page
 */
async function analyzePage(url) {
  try {
    console.log(`Analyzing: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'MadenSEOBot/1.0'
      }
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extract basic SEO data
    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const h1Count = $('h1').length;
    const h2Count = $('h2').length;
    
    // Extract links
    const links = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && (href.startsWith('http') || href.startsWith('/'))) {
        links.push(href);
      }
    });
    
    // Calculate simple score
    let score = 100;
    if (!title) score -= 20;
    if (!metaDescription) score -= 15;
    if (h1Count === 0) score -= 10;
    if (h1Count > 1) score -= 5;
    
    return {
      url,
      title,
      metaDescription,
      h1Count,
      h2Count,
      linksCount: links.length,
      score,
      links,
      analyzedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error analyzing ${url}:`, error.message);
    return {
      url,
      error: error.message,
      score: 0
    };
  }
}

/**
 * Simple site crawler
 */
async function crawlSite(baseUrl, options = {}) {
  const maxPages = options.maxPages || 10;
  const maxDepth = options.maxDepth || 2;
  
  console.log(`Starting crawl of ${baseUrl} (max ${maxPages} pages)`);
  
  const visited = new Set();
  const toVisit = [{ url: normalizeUrl(baseUrl), depth: 0 }];
  const pages = [];
  
  while (toVisit.length > 0 && pages.length < maxPages) {
    const { url, depth } = toVisit.shift();
    
    if (visited.has(url) || depth > maxDepth) continue;
    
    visited.add(url);
    
    const pageData = await analyzePage(url);
    pages.push(pageData);
    
    // Add new URLs to crawl (simplified - only same domain)
    if (depth < maxDepth && pageData.links) {
      const baseHost = new URL(baseUrl).hostname;
      
      for (const link of pageData.links.slice(0, 10)) { // Limit to 10 links per page
        try {
          const linkUrl = new URL(link, url);
          if (linkUrl.hostname === baseHost && !visited.has(linkUrl.href)) {
            toVisit.push({ url: linkUrl.href, depth: depth + 1 });
          }
        } catch (e) {
          // Skip invalid URLs
        }
      }
    }
  }
  
  // Calculate summary
  const totalScore = pages.reduce((sum, p) => sum + (p.score || 0), 0);
  const averageScore = pages.length > 0 ? Math.round(totalScore / pages.length) : 0;
  
  return {
    pages,
    summary: {
      totalPages: pages.length,
      averageScore,
      crawlDepth: Math.max(...pages.map((_, idx) => Math.floor(idx / 10))),
      commonIssues: calculateCommonIssues(pages)
    },
    siteHealth: {
      score: averageScore,
      status: averageScore >= 80 ? 'good' : averageScore >= 60 ? 'needs_improvement' : 'poor',
      grade: averageScore >= 90 ? 'A' : averageScore >= 80 ? 'B' : averageScore >= 70 ? 'C' : averageScore >= 60 ? 'D' : 'F'
    },
    recommendations: generateRecommendations(pages)
  };
}

function calculateCommonIssues(pages) {
  const issues = {};
  
  pages.forEach(page => {
    if (!page.title) {
      issues['missing_title'] = (issues['missing_title'] || 0) + 1;
    }
    if (!page.metaDescription) {
      issues['missing_meta_description'] = (issues['missing_meta_description'] || 0) + 1;
    }
    if (page.h1Count === 0) {
      issues['missing_h1'] = (issues['missing_h1'] || 0) + 1;
    }
  });
  
  return Object.entries(issues)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

function generateRecommendations(pages) {
  const recommendations = [];
  
  const missingTitles = pages.filter(p => !p.title).length;
  if (missingTitles > 0) {
    recommendations.push({
      priority: 'high',
      category: 'metadata',
      message: `${missingTitles} pages are missing title tags. Add unique titles to improve SEO.`
    });
  }
  
  const missingDescriptions = pages.filter(p => !p.metaDescription).length;
  if (missingDescriptions > 0) {
    recommendations.push({
      priority: 'high',
      category: 'metadata',
      message: `${missingDescriptions} pages lack meta descriptions. Add descriptions to improve CTR.`
    });
  }
  
  return recommendations;
}

/**
 * API handler
 */
async function handleFullSiteCrawl(req, res) {
  try {
    const { url, options = {} } = req.body || {};
    
    if (!url) {
      return res.status(400).json({
        status: 'error',
        message: 'URL is required'
      });
    }
    
    console.log(`API: Starting full site crawl for ${url}`);
    
    const crawlResults = await crawlSite(url, options);
    
    return res.json({
      status: 'ok',
      message: 'Full site crawl completed successfully',
      url,
      cached: false,
      timestamp: new Date().toISOString(),
      data: crawlResults
    });
    
  } catch (error) {
    console.error('Full site crawl error:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to perform site crawl',
      error: error.message
    });
  }
}

module.exports = {
  crawlSite,
  analyzePage,
  handleFullSiteCrawl
};