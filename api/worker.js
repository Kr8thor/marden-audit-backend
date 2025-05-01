// Worker for processing audit jobs
const { Redis } = require('@upstash/redis');
const axios = require('axios');
const cheerio = require('cheerio');
const { nanoid } = require('nanoid');
const { 
  redis, 
  keys, 
  getJob, 
  updateJob, 
  getNextJob, 
  cacheData,
  DEFAULT_CACHE_TTL
} = require('./lib/redis.js');

// Process a single job
async function processJob(jobId) {
  try {
    console.log(`Processing job ${jobId}...`);
    
    // Get job data
    const job = await getJob(jobId);
    
    if (!job) {
      console.error(`Job ${jobId} not found`);
      return;
    }
    
    // Update job status to processing
    await updateJob(jobId, { 
      status: 'processing',
      progress: 10 
    });
    
    // Process different job types
    if (job.type === 'page_audit') {
      await processPageAudit(job);
    } else if (job.type === 'site_audit') {
      await processSiteAudit(job);
    } else {
      console.error(`Unknown job type: ${job.type}`);
      await updateJob(jobId, { 
        status: 'failed',
        error: { message: `Unknown job type: ${job.type}` } 
      });
    }
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    try {
      await updateJob(jobId, { 
        status: 'failed',
        error: { 
          message: error.message,
          stack: error.stack 
        } 
      });
    } catch (updateError) {
      console.error(`Error updating job ${jobId} status:`, updateError);
    }
  }
}

// Process a page audit job
async function processPageAudit(job) {
  try {
    const { id, params } = job;
    const { url, options } = params;
    
    // Mock data is not allowed - perform real analysis (requirement #12)
    console.log(`Performing page audit for ${url}...`);
    
    // Update progress
    await updateJob(id, { progress: 30 });
    
    // Fetch the page
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'MardenSEOAuditBot/1.0 (+https://audit.mardenseo.com)'
      }
    });
    
    // Update progress
    await updateJob(id, { progress: 50 });
    
    // Analyze using cheerio
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
    const baseUrl = new URL(url).hostname;
    let internalLinks = 0;
    links.each((i, el) => {
      const href = $(el).attr('href');
      if (href && (!href.startsWith('http') || href.includes(baseUrl))) {
        internalLinks++;
      }
    });
    
    // Calculate scores
    const scores = calculateScores({
      title: titleText,
      description: metaDescription,
      keywords: metaKeywords,
      h1: h1Texts,
      h2: h2Texts,
      h3: h3Texts,
      paragraphs,
      wordCount,
      imgCount,
      imgWithAlt,
      canonicalUrl,
      hasViewport,
      hasRobots,
      linksCount,
      internalLinks
    });
    
    // Generate issues and recommendations
    const { issues, recommendations } = generateIssuesAndRecommendations({
      title: titleText,
      description: metaDescription,
      h1: h1Texts,
      h2: h2Texts,
      wordCount,
      imgCount,
      imgWithAlt,
      canonicalUrl,
      hasViewport
    });
    
    // Update progress
    await updateJob(id, { progress: 80 });
    
    // Create analysis result
    const analysisResult = {
      url: url,
      timestamp: new Date().toISOString(),
      scores,
      issues,
      issueCount: issues.length,
      recommendations,
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
    };
    
    // Cache analysis result
    await cacheData('page', url, analysisResult, DEFAULT_CACHE_TTL);
    
    // Update job with results
    await updateJob(id, { 
      status: 'completed',
      progress: 100,
      completed: Date.now(),
      results: {
        analysis: analysisResult,
        stats: {
          crawlDuration: Date.now() - job.updated,
          analysisTimestamp: new Date().toISOString()
        }
      }
    });
    
    console.log(`Page audit completed for ${url}`);
  } catch (error) {
    console.error(`Error processing page audit:`, error);
    await updateJob(job.id, { 
      status: 'failed',
      error: { 
        message: error.message,
        stack: error.stack 
      } 
    });
  }
}

// Process a site audit job
async function processSiteAudit(job) {
  try {
    const { id, params } = job;
    const { url, options } = params;
    
    // Mock data is not allowed - perform real analysis (requirement #12)
    console.log(`Performing site audit for ${url}...`);
    
    // Update progress
    await updateJob(id, { progress: 20 });
    
    // Parse base URL
    const baseUrl = new URL(url);
    const hostname = baseUrl.hostname;
    
    // Limit of pages to crawl (from options or default)
    const maxPages = options.maxPages || 10;
    const crawlDepth = options.crawlDepth || 2;
    
    // Set to store URLs we've already processed or queued
    const processedUrls = new Set();
    // Queue of URLs to process
    const urlQueue = [url];
    // Results for each page
    const pageResults = {};
    // Issue counters
    const issueTypeCounts = {};
    
    // Start the crawl
    let pagesVisited = 0;
    const startTime = Date.now();
    
    while (urlQueue.length > 0 && pagesVisited < maxPages) {
      const currentUrl = urlQueue.shift();
      
      // Skip if already processed
      if (processedUrls.has(currentUrl)) {
        continue;
      }
      
      processedUrls.add(currentUrl);
      pagesVisited++;
      
      // Update progress
      await updateJob(id, { 
        progress: Math.min(90, 20 + Math.round((pagesVisited / maxPages) * 70))
      });
      
      try {
        // Fetch and analyze the page
        const response = await axios.get(currentUrl, {
          timeout: 15000,
          headers: {
            'User-Agent': 'MardenSEOAuditBot/1.0 (+https://audit.mardenseo.com)'
          }
        });
        
        // Analyze using cheerio
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
        
        // Content analysis
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
        
        // Link analysis and discovery
        const links = $('a');
        const linksCount = links.length;
        const baseHostname = new URL(currentUrl).hostname;
        let internalLinks = 0;
        
        // Collect new URLs for crawling
        if (pagesVisited < maxPages && urlQueue.length + pagesVisited < maxPages) {
          links.each((i, el) => {
            const href = $(el).attr('href');
            if (!href) return;
            
            try {
              // Resolve relative URLs
              const resolvedUrl = new URL(href, currentUrl).href;
              const resolvedHostname = new URL(resolvedUrl).hostname;
              
              // Only add internal links to the queue
              if (resolvedHostname === baseHostname) {
                internalLinks++;
                
                // Add to queue if we haven't processed it and it's a new URL
                if (!processedUrls.has(resolvedUrl) && !urlQueue.includes(resolvedUrl)) {
                  urlQueue.push(resolvedUrl);
                }
              }
            } catch (error) {
              // Skip invalid URLs
            }
          });
        }
        
        // Calculate scores
        const scores = calculateScores({
          title: titleText,
          description: metaDescription,
          keywords: metaKeywords,
          h1: h1Texts,
          h2: h2Texts,
          paragraphs,
          wordCount,
          imgCount,
          imgWithAlt,
          canonicalUrl,
          hasViewport,
          hasRobots,
          linksCount,
          internalLinks
        });
        
        // Generate issues and recommendations
        const { issues, recommendations } = generateIssuesAndRecommendations({
          title: titleText,
          description: metaDescription,
          h1: h1Texts,
          h2: h2Texts,
          wordCount,
          imgCount,
          imgWithAlt,
          canonicalUrl,
          hasViewport
        });
        
        // Create page analysis result
        const pageAnalysis = {
          url: currentUrl,
          timestamp: new Date().toISOString(),
          scores,
          issues,
          issueCount: issues.length,
          recommendations,
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
          }
        };
        
        // Store page result
        pageResults[currentUrl] = pageAnalysis;
        
        // Update issue counters
        issues.forEach(issue => {
          if (!issueTypeCounts[issue.type]) {
            issueTypeCounts[issue.type] = 0;
          }
          issueTypeCounts[issue.type]++;
        });
        
      } catch (pageError) {
        console.error(`Error analyzing page ${currentUrl}:`, pageError);
        
        // Store error as page result
        pageResults[currentUrl] = {
          skipped: true,
          reason: pageError.message
        };
      }
    }
    
    // Calculate crawl duration
    const crawlDuration = Date.now() - startTime;
    
    // Calculate overall scores based on all pages
    const validPageResults = Object.values(pageResults).filter(page => !page.skipped);
    const totalPages = validPageResults.length;
    
    let overallScore = 0;
    let metaScore = 0;
    let contentScore = 0;
    let technicalScore = 0;
    
    if (totalPages > 0) {
      overallScore = Math.round(
        validPageResults.reduce((sum, page) => sum + page.scores.overall, 0) / totalPages
      );
      
      metaScore = Math.round(
        validPageResults.reduce((sum, page) => sum + page.scores.meta, 0) / totalPages
      );
      
      contentScore = Math.round(
        validPageResults.reduce((sum, page) => sum + page.scores.content, 0) / totalPages
      );
      
      technicalScore = Math.round(
        validPageResults.reduce((sum, page) => sum + page.scores.technical, 0) / totalPages
      );
    }
    
    // Count total issues
    const totalIssues = Object.values(issueTypeCounts).reduce((sum, count) => sum + count, 0);
    
    // Get top issues
    const topIssues = Object.entries(issueTypeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Generate site-wide recommendations
    const siteRecommendations = [];
    
    // If more than 50% of pages have the same issue, make it a site-wide recommendation
    Object.entries(issueTypeCounts).forEach(([type, count]) => {
      if (count >= totalPages * 0.5) {
        let recommendation = null;
        
        // Find a sample recommendation from any page
        for (const page of Object.values(pageResults)) {
          if (page.skipped) continue;
          
          const matchingRec = page.recommendations.find(rec => rec.type === `fix_${type}` || rec.type === type.replace('missing_', 'add_'));
          
          if (matchingRec) {
            recommendation = {
              ...matchingRec,
              affectedPages: count,
              examplePages: Object.keys(pageResults)
                .filter(url => {
                  const page = pageResults[url];
                  return !page.skipped && page.issues.some(i => i.type === type);
                })
                .slice(0, 3)
            };
            break;
          }
        }
        
        if (recommendation) {
          siteRecommendations.push(recommendation);
        }
      }
    });
    
    // Create site analysis result
    const siteAnalysisResult = {
      baseUrl: url,
      timestamp: new Date().toISOString(),
      crawlStats: {
        pagesVisited,
        crawlDuration
      },
      scores: {
        overall: overallScore,
        meta: metaScore,
        content: contentScore,
        technical: technicalScore
      },
      totalIssues,
      issueTypeCounts,
      topIssues,
      recommendations: siteRecommendations,
      pages: pageResults,
      realDataFlag: true
    };
    
    // Cache site analysis result
    await cacheData('site', url, siteAnalysisResult, DEFAULT_CACHE_TTL);
    
    // Update job with results
    await updateJob(id, { 
      status: 'completed',
      progress: 100,
      completed: Date.now(),
      results: {
        report: siteAnalysisResult,
        stats: {
          pagesScanned: pagesVisited,
          crawlDuration,
          analysisTimestamp: new Date().toISOString()
        }
      }
    });
    
    console.log(`Site audit completed for ${url}`);
  } catch (error) {
    console.error(`Error processing site audit:`, error);
    await updateJob(job.id, { 
      status: 'failed',
      error: { 
        message: error.message,
        stack: error.stack 
      } 
    });
  }
}

// Helper function to calculate SEO scores
function calculateScores({
  title,
  description,
  keywords,
  h1,
  h2,
  h3,
  paragraphs,
  wordCount,
  imgCount,
  imgWithAlt,
  canonicalUrl,
  hasViewport,
  hasRobots,
  linksCount,
  internalLinks
}) {
  // Meta score
  let metaScore = 0;
  if (title) {
    metaScore += 30;
    if (title.length >= 30 && title.length <= 60) {
      metaScore += 10;
    } else if (title.length < 30) {
      metaScore += Math.floor((title.length / 30) * 10);
    } else if (title.length > 60) {
      metaScore += Math.floor((80 - Math.min(80, title.length)) / 20 * 10);
    }
  }
  
  if (description) {
    metaScore += 25;
    if (description.length >= 50 && description.length <= 160) {
      metaScore += 10;
    } else if (description.length < 50) {
      metaScore += Math.floor((description.length / 50) * 10);
    } else if (description.length > 160) {
      metaScore += Math.floor((250 - Math.min(250, description.length)) / 90 * 10);
    }
  }
  
  if (keywords) {
    metaScore += 5;
  }
  
  // Content score
  let contentScore = 0;
  if (h1 && h1.length === 1) {
    contentScore += 15;
  } else if (h1 && h1.length > 1) {
    contentScore += 5;
  }
  
  if (h2 && h2.length > 0) {
    contentScore += Math.min(10, h2.length * 2);
  }
  
  if (h3 && h3.length > 0) {
    contentScore += Math.min(5, h3.length);
  }
  
  if (wordCount >= 300) {
    contentScore += 20;
  } else if (wordCount >= 100) {
    contentScore += Math.floor((wordCount / 300) * 20);
  }
  
  if (paragraphs && paragraphs > 3) {
    contentScore += 10;
  } else if (paragraphs) {
    contentScore += paragraphs * 3;
  }
  
  if (imgCount > 0) {
    contentScore += Math.min(10, imgCount * 2);
    if (imgCount > 0) {
      const altRatio = imgWithAlt / imgCount;
      contentScore += Math.floor(altRatio * 10);
    }
  }
  
  // Technical score
  let technicalScore = 0;
  if (canonicalUrl) {
    technicalScore += 20;
  }
  
  if (hasViewport) {
    technicalScore += 20;
  }
  
  if (hasRobots) {
    technicalScore += 10;
  }
  
  if (linksCount > 0) {
    technicalScore += Math.min(20, linksCount);
    if (linksCount > 0 && internalLinks > 0) {
      const internalRatio = internalLinks / linksCount;
      technicalScore += Math.floor(internalRatio * 30);
    }
  }
  
  // Ensure scores are between 0-100
  metaScore = Math.max(0, Math.min(100, metaScore));
  contentScore = Math.max(0, Math.min(100, contentScore));
  technicalScore = Math.max(0, Math.min(100, technicalScore));
  
  // Overall score - weighted average
  const overallScore = Math.round((metaScore * 0.3) + (contentScore * 0.4) + (technicalScore * 0.3));
  
  return {
    overall: overallScore,
    meta: metaScore,
    content: contentScore,
    technical: technicalScore
  };
}

// Helper function to generate issues and recommendations
function generateIssuesAndRecommendations({
  title,
  description,
  h1,
  h2,
  wordCount,
  imgCount,
  imgWithAlt,
  canonicalUrl,
  hasViewport
}) {
  const issues = [];
  const recommendations = [];
  
  // Title issues
  if (!title) {
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
  } else if (title.length < 30) {
    issues.push({
      type: 'short_title',
      message: 'Title tag is too short (less than 30 characters)',
      impact: 'medium',
      category: 'meta',
      details: { length: title.length, text: title }
    });
    recommendations.push({
      type: 'improve_title_length',
      message: 'Expand your title to be between 30-60 characters',
      impact: 'medium',
      category: 'meta'
    });
  } else if (title.length > 60) {
    issues.push({
      type: 'long_title',
      message: 'Title tag is too long (more than 60 characters)',
      impact: 'low',
      category: 'meta',
      details: { length: title.length, text: title }
    });
    recommendations.push({
      type: 'shorten_title',
      message: 'Keep your title under 60 characters to ensure full display in search results',
      impact: 'low',
      category: 'meta'
    });
  }
  
  // Meta description issues
  if (!description) {
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
  } else if (description.length < 50) {
    issues.push({
      type: 'short_description',
      message: 'Meta description is too short (less than 50 characters)',
      impact: 'medium',
      category: 'meta',
      details: { length: description.length, text: description }
    });
    recommendations.push({
      type: 'improve_description_length',
      message: 'Expand your meta description to be between 50-160 characters',
      impact: 'medium',
      category: 'meta'
    });
  } else if (description.length > 160) {
    issues.push({
      type: 'long_description',
      message: 'Meta description is too long (more than 160 characters)',
      impact: 'low',
      category: 'meta',
      details: { length: description.length, text: description }
    });
    recommendations.push({
      type: 'shorten_description',
      message: 'Keep your meta description under 160 characters to prevent truncation in search results',
      impact: 'low',
      category: 'meta'
    });
  }
  
  // Heading structure issues
  if (!h1 || h1.length === 0) {
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
  } else if (h1.length > 1) {
    issues.push({
      type: 'multiple_h1',
      message: `Page has ${h1.length} H1 headings`,
      impact: 'medium',
      category: 'content',
      details: { count: h1.length, texts: h1 }
    });
    recommendations.push({
      type: 'consolidate_h1',
      message: 'Use a single H1 heading and convert others to H2 headings',
      impact: 'medium',
      category: 'content'
    });
  }
  
  if (!h2 || h2.length === 0) {
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
  
  return { issues, recommendations };
}

// Start a worker process to process jobs
async function startWorker() {
  const batchSize = parseInt(process.env.BATCH_SIZE, 10) || 5;
  const processingInterval = parseInt(process.env.JOB_PROCESSING_INTERVAL, 10) || 10000;
  
  console.log(`Starting worker with batch size ${batchSize} and interval ${processingInterval}ms`);
  
  // Process jobs at intervals
  setInterval(async () => {
    try {
      // Get next job from queue
      const jobId = await getNextJob();
      
      if (jobId) {
        console.log(`Got job ${jobId} from queue`);
        // Process the job
        await processJob(jobId);
      }
    } catch (error) {
      console.error('Error in worker:', error);
    }
  }, processingInterval);
}

// Check if running as a worker
if (process.env.RUN_WORKER === 'true') {
  startWorker();
}

module.exports = {
  processJob,
  startWorker
};