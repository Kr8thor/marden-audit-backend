/**
 * SEO Analysis Module for Marden Audit Tool
 * Performs comprehensive on-page SEO analysis for any URL
 */
const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

/**
 * Analyze on-page SEO factors for a URL
 * @param {string} urlString URL to analyze
 * @returns {Promise<Object>} Detailed SEO analysis results
 */
async function analyzeSEO(urlString) {
  console.log(`Starting SEO analysis for ${urlString}`);
  const startTime = Date.now();
  
  try {
    // Fetch the URL with a timeout
    console.log(`Fetching ${urlString}...`);
    let response;
    try {
      response = await axios.get(urlString, {
        timeout: 20000, // 20 second timeout
        headers: {
          'User-Agent': 'MardenSEOAuditBot/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache'
        },
        maxContentLength: 5 * 1024 * 1024 // 5MB max
      });
      
      console.log(`Fetch successful for ${urlString}`);
    } catch (error) {
      console.error(`Error fetching ${urlString}: ${error.message}`);
      
      // Return structured error response
      return {
        url: urlString,
        score: 0,
        status: 'error',
        error: {
          type: error.code || 'fetch_error',
          message: error.message || 'Failed to fetch the page'
        },
        timestamp: new Date().toISOString()
      };
    }
    
    // Skip non-HTML responses
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('text/html')) {
      console.log(`Skipping non-HTML content type: ${contentType}`);
      
      return {
        url: urlString,
        score: 0,
        status: 'error',
        error: {
          type: 'invalid_content_type',
          message: `Invalid content type: ${contentType}. SEO analysis requires HTML.`
        },
        timestamp: new Date().toISOString()
      };
    }
    
    // Parse HTML with Cheerio
    const $ = cheerio.load(response.data, {
      normalizeWhitespace: false,
      decodeEntities: false
    });
    
    // Extract SEO elements
    console.log(`Extracting SEO elements from ${urlString}`);
    
    // Title tag
    const title = $('title').text().trim();
    const titleLength = title.length;
    
    // Meta description
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const metaDescriptionLength = metaDescription.length;
    
    // Headings
    const h1Elements = $('h1');
    const h1Count = h1Elements.length;
    const h1Texts = [];
    h1Elements.each((i, el) => {
      if (i < 10) { // Limit to 10 h1 headings
        h1Texts.push($(el).text().trim());
      }
    });
    
    const h2Elements = $('h2');
    const h2Count = h2Elements.length;
    const h2Texts = [];
    h2Elements.each((i, el) => {
      if (i < 15) { // Limit to 15 h2 headings
        h2Texts.push($(el).text().trim());
      }
    });
    
    const h3Elements = $('h3');
    const h3Count = h3Elements.length;
    const h3Texts = [];
    h3Elements.each((i, el) => {
      if (i < 15) { // Limit to 15 h3 headings
        h3Texts.push($(el).text().trim());
      }
    });
    
    // Links
    const internalLinks = [];
    const externalLinks = [];
    const parsedUrl = new URL(urlString);
    const baseDomain = parsedUrl.hostname;
    
    $('a[href]').each((i, el) => {
      try {
        const href = $(el).attr('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
          return;
        }
        
        // Resolve relative URLs
        const absoluteUrl = new URL(href, urlString).href;
        const linkUrl = new URL(absoluteUrl);
        
        if (linkUrl.hostname === baseDomain) {
          if (internalLinks.length < 100) { // Limit to 100 internal links
            internalLinks.push({
              url: absoluteUrl,
              text: $(el).text().trim() || '[No text]',
              nofollow: $(el).attr('rel')?.includes('nofollow') || false
            });
          }
        } else {
          if (externalLinks.length < 50) { // Limit to 50 external links
            externalLinks.push({
              url: absoluteUrl,
              text: $(el).text().trim() || '[No text]',
              nofollow: $(el).attr('rel')?.includes('nofollow') || false
            });
          }
        }
      } catch (error) {
        // Skip invalid URLs
      }
    });
    
    // Images
    const images = [];
    const imagesWithoutAlt = [];
    
    $('img').each((i, el) => {
      if (images.length >= 100) return; // Limit to 100 images
      
      const src = $(el).attr('src');
      if (!src) return;
      
      try {
        // Resolve relative URLs
        const absoluteSrc = new URL(src, urlString).href;
        const alt = $(el).attr('alt') || '';
        
        const image = {
          src: absoluteSrc,
          alt,
          hasAlt: !!alt
        };
        
        images.push(image);
        
        if (!alt) {
          imagesWithoutAlt.push(absoluteSrc);
        }
      } catch (error) {
        // Skip invalid URLs
      }
    });
    
    // Canonical tag
    const canonicalTag = $('link[rel="canonical"]').attr('href') || '';
    
    // Content analysis
    let bodyText = $('body').text().trim();
    bodyText = bodyText.replace(/\s+/g, ' ');
    const wordCount = bodyText.split(/\s+/).length;
    const contentLength = bodyText.length;
    
    // Check viewport for mobile friendliness
    const hasViewport = $('meta[name="viewport"]').length > 0;
    
    // Meta robots
    const robotsContent = $('meta[name="robots"]').attr('content') || '';
    const isNoindex = robotsContent.includes('noindex');
    const isNofollow = robotsContent.includes('nofollow');
    
    // Open Graph tags
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogDescription = $('meta[property="og:description"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || '';
    
    // Twitter card
    const twitterCard = $('meta[name="twitter:card"]').attr('content') || '';
    const twitterTitle = $('meta[name="twitter:title"]').attr('content') || '';
    const twitterDescription = $('meta[name="twitter:description"]').attr('content') || '';
    const twitterImage = $('meta[name="twitter:image"]').attr('content') || '';
    
    // Structured data check
    const structuredData = [];
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const jsonText = $(el).html();
        const json = JSON.parse(jsonText);
        structuredData.push({
          type: json['@type'] || 'Unknown',
          url: json.url || null,
          name: json.name || null
        });
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    // Check for schema.org microdata
    const hasMicrodata = $('[itemscope]').length > 0;
    
    // Page load speed factors (basic)
    const htmlSize = response.data.length;
    const resourceCount = {
      scripts: $('script').length,
      stylesheets: $('link[rel="stylesheet"]').length,
      images: images.length
    };
    
    // Mobile optimization
    const hasTouchIcon = $('link[rel="apple-touch-icon"]').length > 0;
    
    // Create issues and calculate scores
    const issues = [];
    
    // Score categories
    const categories = {
      metadata: { score: 100, issues: [] },
      content: { score: 100, issues: [] },
      technical: { score: 100, issues: [] },
      userExperience: { score: 100, issues: [] }
    };
    
    // Title issues
    if (!title) {
      categories.metadata.score -= 20;
      categories.metadata.issues.push({
        type: 'missing_title',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Add a title tag to your page.'
      });
    } else if (title.length < 30) {
      categories.metadata.score -= 15;
      categories.metadata.issues.push({
        type: 'title_too_short',
        severity: 'warning',
        impact: 'medium',
        current: title,
        recommendation: 'Make your title tag longer (30-60 characters recommended).'
      });
    } else if (title.length > 60) {
      categories.metadata.score -= 5;
      categories.metadata.issues.push({
        type: 'title_too_long',
        severity: 'info',
        impact: 'low',
        current: title,
        recommendation: 'Consider shortening your title tag (30-60 characters recommended).'
      });
    }
    
    // Meta description issues
    if (!metaDescription) {
      categories.metadata.score -= 15;
      categories.metadata.issues.push({
        type: 'missing_meta_description',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Add a meta description to your page.'
      });
    } else if (metaDescription.length < 50) {
      categories.metadata.score -= 10;
      categories.metadata.issues.push({
        type: 'meta_description_too_short',
        severity: 'warning',
        impact: 'medium',
        current: metaDescription,
        recommendation: 'Make your meta description longer (50-160 characters recommended).'
      });
    } else if (metaDescription.length > 160) {
      categories.metadata.score -= 5;
      categories.metadata.issues.push({
        type: 'meta_description_too_long',
        severity: 'info',
        impact: 'low',
        current: metaDescription,
        recommendation: 'Consider shortening your meta description (50-160 characters recommended).'
      });
    }
    
    // H1 issues
    if (h1Count === 0) {
      categories.content.score -= 15;
      categories.content.issues.push({
        type: 'missing_h1',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Add an H1 heading to your page.'
      });
    } else if (h1Count > 1) {
      categories.content.score -= 5;
      categories.content.issues.push({
        type: 'multiple_h1',
        severity: 'warning',
        impact: 'medium',
        current: h1Count,
        recommendation: 'Use only one H1 heading per page.'
      });
    }
    
    // Content issues
    if (wordCount < 300) {
      categories.content.score -= 10;
      categories.content.issues.push({
        type: 'thin_content',
        severity: 'warning',
        impact: 'medium',
        current: wordCount,
        recommendation: 'Add more content to your page (aim for at least 300 words).'
      });
    }
    
    // Image issues
    if (imagesWithoutAlt.length > 0) {
      const penaltyPoints = Math.min(10, imagesWithoutAlt.length);
      categories.content.score -= penaltyPoints;
      categories.content.issues.push({
        type: 'images_missing_alt',
        severity: 'warning',
        impact: 'medium',
        count: imagesWithoutAlt.length,
        current: `${imagesWithoutAlt.length} of ${images.length} images`,
        recommendation: 'Add alt text to all images for better accessibility and SEO.'
      });
    }
    
    // Technical issues
    if (!canonicalTag) {
      categories.technical.score -= 5;
      categories.technical.issues.push({
        type: 'missing_canonical',
        severity: 'info',
        impact: 'low',
        recommendation: 'Add a canonical tag to indicate the preferred version of this page.'
      });
    }
    
    // Mobile issues
    if (!hasViewport) {
      categories.userExperience.score -= 15;
      categories.userExperience.issues.push({
        type: 'missing_viewport',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Add a viewport meta tag for proper mobile rendering.'
      });
    }
    
    // Social media issues
    if (!ogTitle && !ogDescription) {
      categories.metadata.score -= 5;
      categories.metadata.issues.push({
        type: 'missing_og_tags',
        severity: 'info',
        impact: 'low',
        recommendation: 'Add Open Graph tags for better social media sharing.'
      });
    }
    
    if (!twitterCard && !twitterTitle) {
      categories.metadata.score -= 5;
      categories.metadata.issues.push({
        type: 'missing_twitter_tags',
        severity: 'info',
        impact: 'low',
        recommendation: 'Add Twitter Card tags for better Twitter sharing.'
      });
    }
    
    // Structured data issues
    if (structuredData.length === 0 && !hasMicrodata) {
      categories.technical.score -= 5;
      categories.technical.issues.push({
        type: 'no_structured_data',
        severity: 'info',
        impact: 'medium',
        recommendation: 'Add structured data to help search engines understand your content.'
      });
    }
    
    // Calculate overall score
    const overallScore = Math.round(
      (categories.metadata.score * 0.25) +
      (categories.content.score * 0.35) +
      (categories.technical.score * 0.2) +
      (categories.userExperience.score * 0.2)
    );
    
    // Ensure scores are within 0-100 range
    Object.keys(categories).forEach(key => {
      categories[key].score = Math.max(0, Math.min(100, categories[key].score));
    });
    
    // Create recommendations from issues
    const recommendations = [];
    
    // Critical issues as high priority
    Object.values(categories).forEach(category => {
      category.issues.filter(issue => issue.severity === 'critical').forEach(issue => {
        recommendations.push({
          priority: 'high',
          type: issue.type,
          description: issue.recommendation
        });
      });
    });
    
    // Warning issues as medium priority
    Object.values(categories).forEach(category => {
      category.issues.filter(issue => issue.severity === 'warning').forEach(issue => {
        recommendations.push({
          priority: 'medium',
          type: issue.type,
          description: issue.recommendation
        });
      });
    });
    
    // Info issues as low priority
    Object.values(categories).forEach(category => {
      category.issues.filter(issue => issue.severity === 'info').forEach(issue => {
        recommendations.push({
          priority: 'low',
          type: issue.type,
          description: issue.recommendation
        });
      });
    });
    
    // Count issues
    const criticalIssuesCount = Object.values(categories).reduce(
      (count, category) => count + category.issues.filter(issue => issue.severity === 'critical').length,
      0
    );
    
    const totalIssuesCount = Object.values(categories).reduce(
      (count, category) => count + category.issues.length,
      0
    );
    
    // Determine status
    let status = 'good';
    if (overallScore < 50) {
      status = 'poor';
    } else if (overallScore < 80) {
      status = 'needs_improvement';
    }
    
    // Calculate performance metrics
    const endTime = Date.now();
    const analysisTime = endTime - startTime;
    
    // Create the full analysis result
    const result = {
      url: urlString,
      score: overallScore,
      status,
      criticalIssuesCount,
      totalIssuesCount,
      categories,
      recommendations,
      pageData: {
        title: {
          text: title,
          length: titleLength
        },
        metaDescription: {
          text: metaDescription,
          length: metaDescriptionLength
        },
        headings: {
          h1Count,
          h1Texts,
          h2Count,
          h2Texts,
          h3Count,
          h3Texts
        },
        content: {
          wordCount,
          contentLength
        },
        links: {
          internalCount: internalLinks.length,
          externalCount: externalLinks.length,
          totalCount: internalLinks.length + externalLinks.length,
          internal: internalLinks.slice(0, 30), // Limit to 30 examples
          external: externalLinks.slice(0, 20)  // Limit to 20 examples
        },
        images: {
          total: images.length,
          withoutAlt: imagesWithoutAlt.length,
          samples: images.slice(0, 20) // Limit to 20 examples
        },
        technical: {
          hasCanonical: !!canonicalTag,
          canonicalUrl: canonicalTag,
          hasMobileViewport: hasViewport,
          hasStructuredData: structuredData.length > 0 || hasMicrodata,
          structuredDataTypes: structuredData.map(item => item.type)
        },
        social: {
          openGraph: {
            title: ogTitle,
            description: ogDescription,
            image: ogImage
          },
          twitter: {
            card: twitterCard,
            title: twitterTitle,
            description: twitterDescription,
            image: twitterImage
          }
        }
      },
      // For backward compatibility
      pageAnalysis: {
        title: {
          text: title,
          length: titleLength
        },
        metaDescription: {
          text: metaDescription,
          length: metaDescriptionLength
        },
        headings: {
          h1Count,
          h1Texts,
          h2Count,
          h2Texts,
          h3Count
        },
        links: {
          internalCount: internalLinks.length,
          externalCount: externalLinks.length,
          totalCount: internalLinks.length + externalLinks.length
        },
        images: {
          withoutAltCount: imagesWithoutAlt.length,
          total: images.length
        },
        contentLength,
        canonical: canonicalTag
      },
      metadata: {
        analysisTime,
        htmlSize,
        resourceCount
      },
      timestamp: new Date().toISOString(),
      analyzedAt: new Date().toISOString()
    };
    
    console.log(`Completed SEO analysis for ${urlString}`);
    return result;
  } catch (error) {
    console.error(`Error in SEO analysis for ${urlString}:`, error);
    
    // Return error response
    return {
      url: urlString,
      score: 0,
      status: 'error',
      error: {
        type: 'analysis_error',
        message: error.message || 'Unknown error during analysis'
      },
      timestamp: new Date().toISOString(),
      analyzedAt: new Date().toISOString()
    };
  }
}

module.exports = {
  analyzeSEO
};