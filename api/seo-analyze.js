// SEO Analysis endpoint with caching
const axios = require('axios');
const cheerio = require('cheerio');
const { normalizeUrl, getCachedData, cacheData, DEFAULT_CACHE_TTL } = require('./lib/redis.js');

// Score calculation helper functions
function calculateMetaScore(title, description, keywords) {
  let score = 0;
  const maxScore = 100;
  
  // Title checks
  if (title) {
    score += 30; // Basic score for having a title
    
    // Length checks
    if (title.length >= 30 && title.length <= 60) {
      score += 10; // Optimal length
    } else if (title.length < 30) {
      score += Math.floor((title.length / 30) * 10); // Partial score for shorter titles
    } else if (title.length > 60) {
      score += Math.floor((80 - Math.min(80, title.length)) / 20 * 10); // Penalty for very long titles
    }
  }
  
  // Meta description checks
  if (description) {
    score += 25; // Basic score for having a description
    
    // Length checks
    if (description.length >= 50 && description.length <= 160) {
      score += 10; // Optimal length
    } else if (description.length < 50) {
      score += Math.floor((description.length / 50) * 10); // Partial score for shorter descriptions
    } else if (description.length > 160) {
      score += Math.floor((250 - Math.min(250, description.length)) / 90 * 10); // Penalty for very long descriptions
    }
  }
  
  // Meta keywords check (less important these days but still checked)
  if (keywords) {
    score += 5;
  }
  
  // Ensure score is between 0-100
  return Math.max(0, Math.min(100, score));
}

function calculateContentScore(h1, h2, h3, paragraphs, wordCount, imgCount, imgWithAlt) {
  let score = 0;
  const maxScore = 100;
  
  // Heading structure
  if (h1 && h1.length === 1) {
    score += 15; // Single H1 is ideal
  } else if (h1 && h1.length > 1) {
    score += 5; // Multiple H1s - not ideal but better than none
  }
  
  if (h2 && h2.length > 0) {
    score += Math.min(10, h2.length * 2); // Up to 10 points for H2s
  }
  
  if (h3 && h3.length > 0) {
    score += Math.min(5, h3.length); // Up to 5 points for H3s
  }
  
  // Content length
  if (wordCount >= 300) {
    score += 20; // Good content length
  } else if (wordCount >= 100) {
    score += Math.floor((wordCount / 300) * 20); // Partial score for shorter content
  }
  
  // Paragraph structure
  if (paragraphs && paragraphs > 3) {
    score += 10; // Good paragraph structure
  } else if (paragraphs) {
    score += paragraphs * 3; // Some paragraphs
  }
  
  // Image usage
  if (imgCount > 0) {
    score += Math.min(10, imgCount * 2); // Up to 10 points for images
    
    // Alt text ratio
    if (imgCount > 0) {
      const altRatio = imgWithAlt / imgCount;
      score += Math.floor(altRatio * 10); // Up to 10 points for alt text
    }
  }
  
  // Ensure score is between 0-100
  return Math.max(0, Math.min(100, score));
}

function calculateTechnicalScore(canonicalUrl, hasViewport, hasRobots, linksCount, internalLinks) {
  let score = 0;
  const maxScore = 100;
  
  // Canonical URL
  if (canonicalUrl) {
    score += 20;
  }
  
  // Responsive design
  if (hasViewport) {
    score += 20;
  }
  
  // Robots meta
  if (hasRobots) {
    score += 10;
  }
  
  // Link structure
  if (linksCount > 0) {
    score += Math.min(20, linksCount); // Up to 20 points for having links
    
    // Internal linking
    if (linksCount > 0 && internalLinks > 0) {
      const internalRatio = internalLinks / linksCount;
      score += Math.floor(internalRatio * 30); // Up to 30 points for internal linking
    }
  }
  
  // Ensure score is between 0-100
  return Math.max(0, Math.min(100, score));
}

module.exports = async function handler(req, res) {
  // Extract URL parameter
  let targetUrl = null;
  
  if (req.method === 'GET') {
    const urlParts = req.url.split('?');
    if (urlParts.length > 1) {
      const queryParams = new URLSearchParams(urlParts[1]);
      targetUrl = queryParams.get('url');
    }
  } else if (req.method === 'POST' && req.body) {
    if (typeof req.body === 'object') {
      targetUrl = req.body.url;
    } else if (typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        targetUrl = parsed.url;
      } catch (e) {
        console.error('Failed to parse body:', e);
      }
    }
  }
  
  // Validate URL
  if (!targetUrl) {
    return res.status(400).json({
      status: 'error',
      message: 'URL is required'
    });
  }
  
  // Normalize URL
  if (!targetUrl.startsWith('http')) {
    targetUrl = 'https://' + targetUrl;
  }
  
  try {
    // First check cache (Cache-First Strategy - requirement #4)
    const normalizedUrl = normalizeUrl(targetUrl);
    const cachedAnalysis = await getCachedData('analysis', normalizedUrl);
    
    if (cachedAnalysis) {
      console.log(`Serving cached SEO analysis for ${targetUrl}`);
      return res.status(200).json(cachedAnalysis);
    }
    
    // Perform real analysis (Real Data Only - requirement #12)
    console.log(`Performing SEO analysis for ${targetUrl}`);
    const response = await axios.get(targetUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'MardenSEOAuditBot/1.0 (+https://audit.mardenseo.com)'
      }
    });
    
    // Parse with cheerio
    const $ = cheerio.load(response.data);
    
    // Extract meta tags
    const titleText = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
    const canonicalUrl = $('link[rel="canonical"]').attr('href') || '';
    const hasViewport = $('meta[name="viewport"]').length > 0;
    const hasRobots = $('meta[name="robots"]').length > 0;
    
    // Extract headings
    const h1Texts = [];
    $('h1').each((i, el) => {
      h1Texts.push($(el).text().trim());
    });
    
    const h2Texts = [];
    $('h2').each((i, el) => {
      h2Texts.push($(el).text().trim());
    });
    
    const h3Texts = [];
    $('h3').each((i, el) => {
      h3Texts.push($(el).text().trim());
    });
    
    // Count paragraphs and estimate word count
    const paragraphs = $('p').length;
    let wordCount = 0;
    $('p').each((i, el) => {
      const text = $(el).text().trim();
      const words = text.split(/\s+/).filter(word => word.length > 0);
      wordCount += words.length;
    });
    
    // Image analysis
    const images = $('img');
    const imgCount = images.length;
    let imgWithAlt = 0;
    images.each((i, el) => {
      if ($(el).attr('alt')) {
        imgWithAlt++;
      }
    });
    
    // Link analysis
    const links = $('a');
    const linksCount = links.length;
    const baseUrl = new URL(targetUrl).hostname;
    let internalLinks = 0;
    links.each((i, el) => {
      const href = $(el).attr('href');
      if (href && (!href.startsWith('http') || href.includes(baseUrl))) {
        internalLinks++;
      }
    });
    
    // Calculate scores
    const metaScore = calculateMetaScore(titleText, metaDescription, metaKeywords);
    const contentScore = calculateContentScore(h1Texts, h2Texts, h3Texts, paragraphs, wordCount, imgCount, imgWithAlt);
    const technicalScore = calculateTechnicalScore(canonicalUrl, hasViewport, hasRobots, linksCount, internalLinks);
    
    // Overall score - weighted average
    const overallScore = Math.round((metaScore * 0.3) + (contentScore * 0.4) + (technicalScore * 0.3));
    
    // Generate issues and recommendations
    const issues = [];
    const recommendations = [];
    
    // Title issues
    if (!titleText) {
      issues.push({
        type: 'missing_title',
        message: 'Page is missing a title tag',
        impact: 'high',
        category: 'meta'
      });
      recommendations.push({
        type: 'add_title',
        message: 'Add a descriptive title tag between 30-60 characters',
        impact: 'high',
        category: 'meta'
      });
    } else if (titleText.length < 30) {
      issues.push({
        type: 'short_title',
        message: 'Title tag is too short (less than 30 characters)',
        impact: 'medium',
        category: 'meta',
        details: { length: titleText.length, text: titleText }
      });
      recommendations.push({
        type: 'improve_title_length',
        message: 'Expand your title to be between 30-60 characters',
        impact: 'medium',
        category: 'meta'
      });
    } else if (titleText.length > 60) {
      issues.push({
        type: 'long_title',
        message: 'Title tag is too long (more than 60 characters)',
        impact: 'low',
        category: 'meta',
        details: { length: titleText.length, text: titleText }
      });
      recommendations.push({
        type: 'shorten_title',
        message: 'Keep your title under 60 characters to ensure full display in search results',
        impact: 'low',
        category: 'meta'
      });
    }
    
    // Meta description issues
    if (!metaDescription) {
      issues.push({
        type: 'missing_description',
        message: 'Page is missing a meta description',
        impact: 'high',
        category: 'meta'
      });
      recommendations.push({
        type: 'add_description',
        message: 'Add a compelling meta description between 50-160 characters',
        impact: 'high',
        category: 'meta'
      });
    } else if (metaDescription.length < 50) {
      issues.push({
        type: 'short_description',
        message: 'Meta description is too short (less than 50 characters)',
        impact: 'medium',
        category: 'meta',
        details: { length: metaDescription.length, text: metaDescription }
      });
      recommendations.push({
        type: 'improve_description_length',
        message: 'Expand your meta description to be between 50-160 characters',
        impact: 'medium',
        category: 'meta'
      });
    } else if (metaDescription.length > 160) {
      issues.push({
        type: 'long_description',
        message: 'Meta description is too long (more than 160 characters)',
        impact: 'low',
        category: 'meta',
        details: { length: metaDescription.length, text: metaDescription }
      });
      recommendations.push({
        type: 'shorten_description',
        message: 'Keep your meta description under 160 characters to prevent truncation in search results',
        impact: 'low',
        category: 'meta'
      });
    }
    
    // Heading structure issues
    if (h1Texts.length === 0) {
      issues.push({
        type: 'missing_h1',
        message: 'Page has no H1 heading',
        impact: 'high',
        category: 'content'
      });
      recommendations.push({
        type: 'add_h1',
        message: 'Add a single H1 heading that clearly describes the page content',
        impact: 'high',
        category: 'content'
      });
    } else if (h1Texts.length > 1) {
      issues.push({
        type: 'multiple_h1',
        message: `Page has ${h1Texts.length} H1 headings`,
        impact: 'medium',
        category: 'content',
        details: { count: h1Texts.length, texts: h1Texts }
      });
      recommendations.push({
        type: 'consolidate_h1',
        message: 'Use a single H1 heading and convert others to H2 headings',
        impact: 'medium',
        category: 'content'
      });
    }
    
    if (h2Texts.length === 0) {
      issues.push({
        type: 'missing_h2',
        message: 'Page has no H2 headings',
        impact: 'medium',
        category: 'content'
      });
      recommendations.push({
        type: 'add_h2',
        message: 'Add H2 headings to structure your content and improve readability',
        impact: 'medium',
        category: 'content'
      });
    }
    
    // Content issues
    if (wordCount < 300) {
      issues.push({
        type: 'thin_content',
        message: `Page has limited content (${wordCount} words)`,
        impact: 'high',
        category: 'content',
        details: { wordCount }
      });
      recommendations.push({
        type: 'expand_content',
        message: 'Add more quality content, aim for at least 300 words',
        impact: 'high',
        category: 'content'
      });
    }
    
    // Image issues
    if (imgCount > 0 && imgWithAlt < imgCount) {
      issues.push({
        type: 'missing_alt',
        message: `${imgCount - imgWithAlt} of ${imgCount} images are missing alt text`,
        impact: 'medium',
        category: 'content',
        details: { total: imgCount, missing: imgCount - imgWithAlt }
      });
      recommendations.push({
        type: 'add_alt',
        message: 'Add descriptive alt text to all images for accessibility and SEO',
        impact: 'medium',
        category: 'content'
      });
    }
    
    // Technical issues
    if (!canonicalUrl) {
      issues.push({
        type: 'missing_canonical',
        message: 'Page is missing a canonical URL',
        impact: 'medium',
        category: 'technical'
      });
      recommendations.push({
        type: 'add_canonical',
        message: 'Add a canonical tag to prevent duplicate content issues',
        impact: 'medium',
        category: 'technical'
      });
    }
    
    if (!hasViewport) {
      issues.push({
        type: 'missing_viewport',
        message: 'Page is missing a viewport meta tag',
        impact: 'high',
        category: 'technical'
      });
      recommendations.push({
        type: 'add_viewport',
        message: 'Add a viewport meta tag for proper mobile rendering',
        impact: 'high',
        category: 'technical'
      });
    }
    
    // Generate analysis result
    const analysisResult = {
      url: targetUrl,
      timestamp: new Date().toISOString(),
      scores: {
        overall: overallScore,
        meta: metaScore,
        content: contentScore,
        technical: technicalScore
      },
      issues: issues,
      issueCount: issues.length,
      recommendations: recommendations,
      categories: {
        meta: {
          title: {
            text: titleText,
            length: titleText.length
          },
          description: {
            text: metaDescription,
            length: metaDescription.length
          },
          keywords: metaKeywords,
          canonical: canonicalUrl,
          hasViewport,
          hasRobots
        },
        content: {
          headings: {
            h1: {
              count: h1Texts.length,
              texts: h1Texts
            },
            h2: {
              count: h2Texts.length,
              texts: h2Texts.slice(0, 5) // First 5 H2 texts
            },
            h3: {
              count: h3Texts.length,
              texts: h3Texts.slice(0, 5) // First 5 H3 texts
            }
          },
          paragraphs,
          wordCount,
          images: {
            count: imgCount,
            withAlt: imgWithAlt,
            altTextRatio: imgCount > 0 ? (imgWithAlt / imgCount) : 0
          }
        },
        technical: {
          links: {
            count: linksCount,
            internal: internalLinks,
            external: linksCount - internalLinks,
            internalRatio: linksCount > 0 ? (internalLinks / linksCount) : 0
          }
        }
      },
      realDataFlag: true,
      cached: false
    };
    
    // Cache the result for future requests
    await cacheData('analysis', normalizedUrl, analysisResult);
    
    // Return analysis result
    return res.status(200).json(analysisResult);
  } catch (fetchError) {
    console.error(`Error analyzing ${targetUrl}:`, fetchError);
    
    return res.status(400).json({
      status: 'error',
      message: 'Failed to analyze URL',
      error: fetchError.message,
      url: targetUrl
    });
  }
};