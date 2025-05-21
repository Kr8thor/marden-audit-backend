const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Marden SEO Audit Tool - Mobile-Friendly Analyzer
 * This module analyzes mobile-friendliness factors
 */

/**
 * Analyze mobile-friendliness of a web page
 * @param {string} url - URL to analyze
 * @param {string} html - HTML content (optional)
 * @returns {Promise<Object>} - Mobile-friendly analysis
 */
async function analyzeMobileFriendliness(url, html = null) {
  try {
    // Fetch HTML if not provided
    if (!html) {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36 MardenSEO-Audit/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });
      html = response.data;
    }
    
    const $ = cheerio.load(html);
    
    // Check viewport meta tag
    const viewportMeta = $('meta[name="viewport"]').attr('content') || '';
    const hasViewport = viewportMeta.length > 0;
    const hasWidthInViewport = viewportMeta.includes('width=device-width');
    const hasInitialScaleInViewport = viewportMeta.includes('initial-scale=1');
    
    // Check text size and readability
    const baseFontSize = $('body').css('font-size') || '';
    const minFontSize = Math.min(...$('p, li, td, th').map((i, el) => {
      const fontSize = $(el).css('font-size') || '';
      if (fontSize.endsWith('px')) {
        return parseInt(fontSize);
      }
      return 16; // Default browser font size
    }).get().filter(Boolean));
    
    // Check tap targets spacing
    const smallButtonsOrLinks = $('a, button, input[type="button"], input[type="submit"]').filter((i, el) => {
      const $el = $(el);
      const width = $el.css('width');
      const height = $el.css('height');
      
      // Consider small if less than 44px (recommended tap target size)
      return (width && width.endsWith('px') && parseInt(width) < 44) ||
             (height && height.endsWith('px') && parseInt(height) < 44);
    }).length;
    
    // Check for horizontal scrolling issues
    const hasFixedWidth = $('body').attr('style') && $('body').attr('style').includes('width:') && !$('body').attr('style').includes('width:100%');
    const hasOverflowX = $('body').css('overflow-x') === 'scroll' || $('body').css('overflow') === 'scroll';
    
    // Check for mobile-specific elements
    const hasAmpLink = $('link[rel="amphtml"]').length > 0;
    const hasMobileAlternate = $('link[rel="alternate"][media="only screen and (max-width: 640px)"]').length > 0;
    
    // Check media queries for responsiveness
    const styleLinks = $('link[rel="stylesheet"]');
    const styleBlocks = $('style');
    let mediaQueryCount = 0;
    
    styleBlocks.each((i, el) => {
      const content = $(el).html() || '';
      mediaQueryCount += (content.match(/@media/g) || []).length;
    });
    
    // Check common mobile issues
    const usesFlash = $('object[type="application/x-shockwave-flash"], embed[type="application/x-shockwave-flash"]').length > 0;
    
    // Calculate score based on factors
    let score = 70; // Default score
    const issues = [];
    
    // Viewport issues
    if (!hasViewport) {
      score -= 25;
      issues.push({
        type: 'missing_viewport',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Add a viewport meta tag with content="width=device-width, initial-scale=1"'
      });
    } else {
      if (!hasWidthInViewport) {
        score -= 15;
        issues.push({
          type: 'incomplete_viewport',
          severity: 'warning',
          impact: 'medium',
          recommendation: 'Add width=device-width to your viewport meta tag'
        });
      }
      
      if (!hasInitialScaleInViewport) {
        score -= 10;
        issues.push({
          type: 'missing_scale',
          severity: 'warning',
          impact: 'medium',
          recommendation: 'Add initial-scale=1 to your viewport meta tag'
        });
      }
    }
    
    // Font size issues
    if (minFontSize < 12) {
      score -= 10;
      issues.push({
        type: 'small_font',
        severity: 'warning',
        impact: 'medium',
        recommendation: 'Increase minimum font size to at least 12px for mobile readability'
      });
    }
    
    // Tap target issues
    if (smallButtonsOrLinks > 5) {
      score -= 15;
      issues.push({
        type: 'small_tap_targets',
        severity: 'warning',
        impact: 'medium',
        recommendation: 'Increase size of buttons and links to at least 44x44px for better tappability'
      });
    } else if (smallButtonsOrLinks > 0) {
      score -= 5;
      issues.push({
        type: 'few_small_tap_targets',
        severity: 'info',
        impact: 'low',
        recommendation: 'Consider increasing size of some smaller buttons and links for better mobile usability'
      });
    }
    
    // Horizontal scrolling issues
    if (hasFixedWidth || hasOverflowX) {
      score -= 20;
      issues.push({
        type: 'horizontal_scroll',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Remove fixed width containers and horizontal scrolling to improve mobile experience'
      });
    }
    
    // Media query issues
    if (mediaQueryCount === 0) {
      score -= 15;
      issues.push({
        type: 'no_media_queries',
        severity: 'warning',
        impact: 'medium',
        recommendation: 'Add CSS media queries to create a responsive design'
      });
    } else if (mediaQueryCount < 3) {
      score -= 5;
      issues.push({
        type: 'few_media_queries',
        severity: 'info',
        impact: 'low',
        recommendation: 'Consider adding more media queries to improve responsiveness across different device sizes'
      });
    }
    
    // Flash content issues
    if (usesFlash) {
      score -= 25;
      issues.push({
        type: 'uses_flash',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Remove Flash content as mobile devices do not support it'
      });
    }
    
    // Ensure score is in range
    score = Math.max(0, Math.min(100, score));
    
    // Determine status
    let status = 'good';
    if (score < 50) {
      status = 'poor';
    } else if (score < 80) {
      status = 'needs_improvement';
    }
    
    // Generate recommendations
    const recommendations = issues.map(issue => issue.recommendation);
    
    // Generate positive aspects
    const positiveAspects = [];
    
    if (hasViewport && hasWidthInViewport && hasInitialScaleInViewport) {
      positiveAspects.push('Proper viewport configuration');
    }
    
    if (mediaQueryCount >= 3) {
      positiveAspects.push('Good use of responsive media queries');
    }
    
    if (minFontSize >= 14) {
      positiveAspects.push('Font size is readable on mobile devices');
    }
    
    if (smallButtonsOrLinks === 0) {
      positiveAspects.push('All tap targets are appropriately sized');
    }
    
    if (hasAmpLink) {
      positiveAspects.push('AMP version available for faster mobile loading');
    }
    
    return {
      url,
      mobileFriendliness: {
        score,
        status,
        issues: issues.length,
        criticalIssues: issues.filter(i => i.severity === 'critical').length,
        factors: {
          viewport: {
            present: hasViewport,
            hasWidth: hasWidthInViewport,
            hasInitialScale: hasInitialScaleInViewport,
            value: viewportMeta
          },
          textSize: {
            minFontSize: minFontSize || 'unknown'
          },
          tapTargets: {
            smallTargetsCount: smallButtonsOrLinks
          },
          responsiveDesign: {
            mediaQueryCount,
            hasFixedWidth,
            hasHorizontalScroll: hasOverflowX
          },
          compatibility: {
            usesFlash,
            hasAmpVersion: hasAmpLink,
            hasMobileVersion: hasMobileAlternate
          }
        },
        issues,
        recommendations,
        positiveAspects
      }
    };
  } catch (error) {
    console.error(`Error analyzing mobile-friendliness for ${url}:`, error);
    return {
      url,
      mobileFriendliness: {
        score: 0,
        status: 'error',
        issues: 1,
        criticalIssues: 1,
        error: error.message,
        recommendations: [
          'Ensure your site is accessible to mobile crawlers',
          'Implement a responsive design that works across all devices'
        ]
      }
    };
  }
}

module.exports = {
  analyzeMobileFriendliness
};