/**
 * Enhanced SEO Analysis Engine
 * Properly extracts SEO data from modern websites
 */

const cheerio = require('cheerio');
const axios = require('axios');
const { URL } = require('url');

/**
 * Robust HTML fetcher with proper configuration
 */
async function fetchHtml(url) {
  try {
    console.log(`🌐 Fetching HTML from: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 30000, // 30 second timeout
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1'
      },
      validateStatus: function (status) {
        return status >= 200 && status < 400; // Accept redirects and success
      }
    });

    if (!response.data || typeof response.data !== 'string') {
      throw new Error('No HTML content received');
    }

    console.log(`✅ Successfully fetched ${response.data.length} characters of HTML`);
    return response.data;

  } catch (error) {
    console.error(`❌ Error fetching HTML from ${url}:`, error.message);
    
    // Provide specific error messages
    if (error.code === 'ENOTFOUND') {
      throw new Error(`Domain not found: ${url}. Please check if the website URL is correct.`);
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new Error(`Request timed out for ${url}. The website may be slow or unreachable.`);
    } else if (error.response && error.response.status) {
      throw new Error(`HTTP ${error.response.status} error for ${url}`);
    } else {
      throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
  }
}

/**
 * Extract page title with multiple fallback strategies
 */
function extractTitle($) {
  let title = '';
  
  // Strategy 1: Standard title tag
  title = $('title').first().text().trim();
  if (title) {
    console.log(`📝 Found title via <title> tag: "${title}"`);
    return title;
  }
  
  // Strategy 2: Open Graph title
  title = $('meta[property="og:title"]').attr('content');
  if (title) {
    console.log(`📝 Found title via og:title: "${title}"`);
    return title.trim();
  }
  
  // Strategy 3: Twitter title
  title = $('meta[name="twitter:title"]').attr('content');
  if (title) {
    console.log(`📝 Found title via twitter:title: "${title}"`);
    return title.trim();
  }
  
  // Strategy 4: H1 as fallback
  title = $('h1').first().text().trim();
  if (title) {
    console.log(`📝 Found title via H1 fallback: "${title}"`);
    return title;
  }
  
  console.log(`❌ No title found`);
  return '';
}

/**
 * Extract meta description with multiple fallback strategies
 */
function extractMetaDescription($) {
  let description = '';
  
  // Strategy 1: Standard meta description
  description = $('meta[name="description"]').attr('content');
  if (description) {
    console.log(`📄 Found description via meta[name="description"]: "${description.substring(0, 100)}..."`);
    return description.trim();
  }
  
  // Strategy 2: Open Graph description
  description = $('meta[property="og:description"]').attr('content');
  if (description) {
    console.log(`📄 Found description via og:description: "${description.substring(0, 100)}..."`);
    return description.trim();
  }
  
  // Strategy 3: Twitter description
  description = $('meta[name="twitter:description"]').attr('content');
  if (description) {
    console.log(`📄 Found description via twitter:description: "${description.substring(0, 100)}..."`);
    return description.trim();
  }
  
  console.log(`❌ No meta description found`);
  return '';
}

/**
 * Extract and analyze page content
 */
function analyzeContent($) {
  // Remove script and style elements for content analysis
  $('script, style, noscript').remove();
  
  const bodyText = $('body').text() || '';
  const cleanedText = bodyText.replace(/\s+/g, ' ').trim();
  
  return {
    wordCount: cleanedText.split(' ').filter(word => word.length > 0).length,
    contentLength: cleanedText.length,
    hasContent: cleanedText.length > 0
  };
}

/**
 * Enhanced SEO analysis function
 */
async function performSeoAnalysis(url) {
  try {
    console.log(`🚀 Starting enhanced SEO analysis for: ${url}`);
    
    // Fetch HTML
    const html = await fetchHtml(url);
    
    // Parse with Cheerio
    const $ = cheerio.load(html, {
      normalizeWhitespace: false,
      xmlMode: false,
      decodeEntities: true
    });
    
    console.log(`🔍 Parsing HTML with Cheerio...`);
    
    // Extract basic page elements
    const title = extractTitle($);
    const metaDescription = extractMetaDescription($);
    const contentAnalysis = analyzeContent($);
    
    // Analyze headings
    const h1Elements = $('h1');
    const h2Elements = $('h2');
    const h3Elements = $('h3');
    
    const h1Texts = [];
    h1Elements.each((i, el) => {
      const text = $(el).text().trim();
      if (text && h1Texts.length < 10) h1Texts.push(text);
    });
    
    const h2Texts = [];
    h2Elements.each((i, el) => {
      const text = $(el).text().trim();
      if (text && h2Texts.length < 15) h2Texts.push(text);
    });
    
    // Analyze links
    const allLinks = $('a[href]');
    let internalCount = 0;
    let externalCount = 0;
    
    allLinks.each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        if (href.startsWith('http://') || href.startsWith('https://')) {
          try {
            const linkDomain = new URL(href).hostname;
            const baseDomain = new URL(url).hostname;
            if (linkDomain === baseDomain) {
              internalCount++;
            } else {
              externalCount++;
            }
          } catch (e) {
            // Invalid URL, skip
          }
        } else {
          internalCount++; // Relative links are internal
        }
      }
    });
    
    // Analyze images
    const allImages = $('img');
    let imagesWithoutAlt = 0;
    
    allImages.each((i, el) => {
      const alt = $(el).attr('alt');
      if (!alt || alt.trim() === '') {
        imagesWithoutAlt++;
      }
    });
    
    // Check for canonical URL
    const canonicalUrl = $('link[rel="canonical"]').attr('href') || '';
    
    // Validate we got meaningful data
    if (!title && !metaDescription && contentAnalysis.wordCount === 0) {
      throw new Error('No meaningful content could be extracted from the page. The website may be JavaScript-heavy or have content loading issues.');
    }
    
    // Build analysis result
    const analysisResult = {
      url: url,
      score: 0, // Will be calculated
      status: 'unknown',
      criticalIssuesCount: 0,
      totalIssuesCount: 0,
      categories: {
        metadata: { score: 0, issues: [] },
        content: { score: 0, issues: [] },
        technical: { score: 0, issues: [] },
        userExperience: { score: 0, issues: [] }
      },
      pageData: {
        title: {
          text: title,
          length: title.length
        },
        metaDescription: {
          text: metaDescription,
          length: metaDescription.length
        },
        headings: {
          h1Count: h1Elements.length,
          h1Texts: h1Texts,
          h2Count: h2Elements.length,
          h2Texts: h2Texts,
          h3Count: h3Elements.length
        },
        content: {
          wordCount: contentAnalysis.wordCount,
          contentLength: contentAnalysis.contentLength
        },
        links: {
          internalCount: internalCount,
          externalCount: externalCount,
          totalCount: allLinks.length
        },
        images: {
          total: allImages.length,
          withoutAlt: imagesWithoutAlt
        },
        technical: {
          hasCanonical: canonicalUrl.length > 0,
          canonicalUrl: canonicalUrl
        }
      },
      recommendations: [],
      metadata: {
        analysisTime: Date.now(),
        htmlSize: `${Math.round(html.length / 1024)} KB`
      },
      analyzedAt: new Date().toISOString()
    };
    
    // Calculate scores and issues
    analysisResult.categories.metadata = analyzeMetadata(analysisResult.pageData, analysisResult.recommendations);
    analysisResult.categories.content = analyzeContent2(analysisResult.pageData, analysisResult.recommendations);
    analysisResult.categories.technical = analyzeTechnical(analysisResult.pageData, analysisResult.recommendations);
    analysisResult.categories.userExperience = analyzeUserExperience(analysisResult.pageData, analysisResult.recommendations);
    
    // Calculate overall score
    const categoryScores = Object.values(analysisResult.categories).map(cat => cat.score);
    analysisResult.score = Math.round(categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length);
    
    // Count issues
    analysisResult.totalIssuesCount = Object.values(analysisResult.categories)
      .reduce((total, cat) => total + (cat.issues ? cat.issues.length : 0), 0);
    analysisResult.criticalIssuesCount = Object.values(analysisResult.categories)
      .reduce((total, cat) => total + (cat.issues ? cat.issues.filter(issue => issue.severity === 'critical').length : 0), 0);
    
    // Set status
    if (analysisResult.score >= 80) {
      analysisResult.status = 'good';
    } else if (analysisResult.score >= 50) {
      analysisResult.status = 'needs_improvement';
    } else {
      analysisResult.status = 'poor';
    }
    
    console.log(`✅ Analysis completed - Score: ${analysisResult.score}, Issues: ${analysisResult.totalIssuesCount}`);
    return analysisResult;
    
  } catch (error) {
    console.error(`❌ SEO analysis failed for ${url}:`, error.message);
    throw error;
  }
}

/**
 * Analyze metadata quality
 */
function analyzeMetadata(pageData, recommendations) {
  const issues = [];
  let score = 100;
  
  // Check title
  if (!pageData.title.text) {
    issues.push({
      type: 'missing_title',
      severity: 'critical',
      message: 'Page is missing a title tag',
      recommendation: 'Add a unique, descriptive title tag (50-60 characters)'
    });
    score -= 30;
  } else if (pageData.title.length < 30) {
    issues.push({
      type: 'short_title',
      severity: 'warning',
      message: 'Title tag is too short',
      recommendation: 'Expand title to 50-60 characters for better visibility'
    });
    score -= 10;
  } else if (pageData.title.length > 60) {
    issues.push({
      type: 'long_title',
      severity: 'warning',
      message: 'Title tag is too long and may be truncated',
      recommendation: 'Shorten title to 50-60 characters'
    });
    score -= 10;
  }
  
  // Check meta description
  if (!pageData.metaDescription.text) {
    issues.push({
      type: 'missing_description',
      severity: 'critical',
      message: 'Page is missing a meta description',
      recommendation: 'Add a compelling meta description (150-160 characters)'
    });
    score -= 30;
  } else if (pageData.metaDescription.length < 120) {
    issues.push({
      type: 'short_description',
      severity: 'warning',
      message: 'Meta description is too short',
      recommendation: 'Expand meta description to 150-160 characters'
    });
    score -= 10;
  } else if (pageData.metaDescription.length > 160) {
    issues.push({
      type: 'long_description',
      severity: 'warning',
      message: 'Meta description is too long and may be truncated',
      recommendation: 'Shorten meta description to 150-160 characters'
    });
    score -= 10;
  }
  
  return { score: Math.max(0, score), issues };
}

/**
 * Analyze content quality
 */
function analyzeContent2(pageData, recommendations) {
  const issues = [];
  let score = 100;
  
  // Check word count
  if (pageData.content.wordCount < 300) {
    issues.push({
      type: 'low_word_count',
      severity: 'warning',
      message: 'Page has very little content',
      recommendation: 'Add more substantive content (aim for 300+ words)'
    });
    score -= 20;
  }
  
  // Check headings
  if (pageData.headings.h1Count === 0) {
    issues.push({
      type: 'missing_h1',
      severity: 'critical',
      message: 'Page is missing an H1 heading',
      recommendation: 'Add a clear H1 heading that describes the page content'
    });
    score -= 25;
  } else if (pageData.headings.h1Count > 1) {
    issues.push({
      type: 'multiple_h1',
      severity: 'warning',
      message: 'Page has multiple H1 headings',
      recommendation: 'Use only one H1 heading per page'
    });
    score -= 15;
  }
  
  return { score: Math.max(0, score), issues };
}

/**
 * Analyze technical SEO factors
 */
function analyzeTechnical(pageData, recommendations) {
  const issues = [];
  let score = 100;
  
  // Check canonical URL
  if (!pageData.technical.hasCanonical) {
    issues.push({
      type: 'missing_canonical',
      severity: 'warning',
      message: 'Page is missing a canonical URL',
      recommendation: 'Add a canonical link tag to prevent duplicate content issues'
    });
    score -= 10;
  }
  
  return { score: Math.max(0, score), issues };
}

/**
 * Analyze user experience factors
 */
function analyzeUserExperience(pageData, recommendations) {
  const issues = [];
  let score = 100;
  
  // Check images without alt text
  if (pageData.images.withoutAlt > 0) {
    issues.push({
      type: 'images_without_alt',
      severity: 'warning',
      message: `${pageData.images.withoutAlt} images are missing alt text`,
      recommendation: 'Add descriptive alt text to all images for accessibility'
    });
    score -= Math.min(30, pageData.images.withoutAlt * 3);
  }
  
  return { score: Math.max(0, score), issues };
}

module.exports = {
  performSeoAnalysis
};