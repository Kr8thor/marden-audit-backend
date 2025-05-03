// Job processor/worker - Process jobs from the queue
const axios = require('axios');
const cheerio = require('cheerio');
const { 
  getNextJob, 
  getJob, 
  updateJob, 
  cacheData 
} = require('./lib/redis.js');

// Process job
async function processJob(jobId) {
  try {
    // Get job data
    const job = await getJob(jobId);
    
    if (!job) {
      console.error(`Job ${jobId} not found`);
      return false;
    }
    
    // Update job status to processing
    await updateJob(jobId, {
      status: 'processing',
      progress: 10,
      message: 'Job processing started'
    });
    
    console.log(`Processing job ${jobId} of type ${job.type}`);
    
    // Process based on job type
    let result = null;
    
    if (job.type === 'page_audit') {
      result = await processPageAudit(job);
    } else if (job.type === 'site_audit') {
      result = await processSiteAudit(job);
    } else {
      console.error(`Unknown job type: ${job.type}`);
      await updateJob(jobId, {
        status: 'failed',
        error: `Unknown job type: ${job.type}`,
        message: 'Job failed - unknown type'
      });
      return false;
    }
    
    // Update job with results
    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      results: result,
      completed: Date.now(),
      message: 'Job completed successfully'
    });
    
    // Cache results based on job type and requirements
    if (job.type === 'page_audit') {
      // Cache page audit for 1 hour per requirement #8
      await cacheData(
        'page', 
        job.params.url, 
        result,
        3600
      );
    } else if (job.type === 'site_audit') {
      // Cache site audit for 4 hours per requirement #8
      const options = job.params.options || {};
      await cacheData(
        'site', 
        `${job.params.url}:max${options.maxPages || 10}:depth${options.crawlDepth || 2}`, 
        result,
        14400
      );
    }
    
    return true;
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    
    // Implement graceful degradation per requirement #5
    try {
      await updateJob(jobId, {
        status: 'failed',
        error: error.message,
        message: 'Job processing failed'
      });
    } catch (updateError) {
      console.error(`Failed to update job ${jobId} after error:`, updateError);
    }
    
    return false;
  }
}

// Process page audit job
async function processPageAudit(job) {
  const { url } = job.params;
  
  // Update progress
  await updateJob(job.id, {
    progress: 20,
    message: 'Fetching page content'
  });
  
  try {
    // Fetch page with timeout per requirement #27
    const response = await axios.get(url, {
      timeout: 20000,
      headers: {
        'User-Agent': 'MardenSEOAuditBot/1.0 (+https://audit.mardenseo.com)'
      }
    });
    
    // Update progress
    await updateJob(job.id, {
      progress: 50,
      message: 'Analyzing page content'
    });
    
    // Parse with cheerio
    const $ = cheerio.load(response.data);
    
    // Extract SEO elements - comprehensive framework per requirement #14
    const titleText = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const canonicalUrl = $('link[rel="canonical"]').attr('href') || '';
    const hreflangLinks = [];
    $('link[rel="alternate"][hreflang]').each((i, el) => {
      hreflangLinks.push({
        hreflang: $(el).attr('hreflang'),
        href: $(el).attr('href')
      });
    });
    
    // Extract headings
    const h1Elements = $('h1');
    const h2Elements = $('h2');
    const h3Elements = $('h3');
    
    const h1Texts = [];
    h1Elements.each((i, el) => {
      h1Texts.push($(el).text().trim());
    });
    
    const h2Texts = [];
    h2Elements.each((i, el) => {
      h2Texts.push($(el).text().trim());
    });
    
    // Extract images without alt text
    const imagesWithoutAlt = [];
    $('img').each((i, el) => {
      const alt = $(el).attr('alt');
      const src = $(el).attr('src');
      if (!alt && src) {
        imagesWithoutAlt.push(src);
      }
    });
    
    // Calculate total content length
    let contentText = $('body').text().trim();
    contentText = contentText.replace(/\\s+/g, ' ');
    const contentLength = contentText.length;
    const wordCount = contentText.split(/\\s+/).length;
    
    // Count internal and external links
    const internalLinks = [];
    const externalLinks = [];
    
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        return;
      }
      
      try {
        const linkUrl = new URL(href, url);
        
        if (linkUrl.hostname === new URL(url).hostname) {
          internalLinks.push(linkUrl.href);
        } else {
          externalLinks.push(linkUrl.href);
        }
      } catch (error) {
        // Skip malformed URLs
      }
    });
    
    // Check for structured data
    const structuredData = [];
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const jsonText = $(el).html();
        const json = JSON.parse(jsonText);
        structuredData.push({
          type: json['@type'] || 'Unknown',
          data: json
        });
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    // Check for mobile-friendliness
    const viewportTag = $('meta[name="viewport"]').attr('content') || '';
    const hasMobileViewport = viewportTag.includes('width=device-width');
    
    // Update progress
    await updateJob(job.id, {
      progress: 80,
      message: 'Calculating score and recommendations'
    });
    
    // Multi-dimensional scoring per requirement #15
    const categories = {
      metadata: { score: 0, maxScore: 25, issues: [] },
      content: { score: 0, maxScore: 35, issues: [] },
      technical: { score: 0, maxScore: 25, issues: [] },
      userExperience: { score: 0, maxScore: 15, issues: [] }
    };
    
    // Title checks (metadata)
    if (!titleText) {
      categories.metadata.issues.push({
        type: 'missing_title',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Add a title tag to your page'
      });
    } else if (titleText.length < 30) {
      categories.metadata.issues.push({
        type: 'title_too_short',
        severity: 'warning',
        impact: 'medium',
        current: titleText,
        recommendation: 'Make your title tag longer (30-60 characters recommended)'
      });
    } else if (titleText.length > 60) {
      categories.metadata.issues.push({
        type: 'title_too_long',
        severity: 'info',
        impact: 'low',
        current: titleText,
        recommendation: 'Consider shortening your title tag (30-60 characters recommended)'
      });
    } else {
      categories.metadata.score += 10;
    }
    
    // Meta description checks (metadata)
    if (!metaDescription) {
      categories.metadata.issues.push({
        type: 'missing_meta_description',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Add a meta description to your page'
      });
    } else if (metaDescription.length < 50) {
      categories.metadata.issues.push({
        type: 'meta_description_too_short',
        severity: 'warning',
        impact: 'medium',
        current: metaDescription,
        recommendation: 'Make your meta description longer (50-160 characters recommended)'
      });
    } else if (metaDescription.length > 160) {
      categories.metadata.issues.push({
        type: 'meta_description_too_long',
        severity: 'info',
        impact: 'low',
        current: metaDescription,
        recommendation: 'Consider shortening your meta description (50-160 characters recommended)'
      });
    } else {
      categories.metadata.score += 10;
    }
    
    // Canonical tag check (metadata)
    if (!canonicalUrl) {
      categories.metadata.issues.push({
        type: 'missing_canonical',
        severity: 'warning',
        impact: 'medium',
        recommendation: 'Add a canonical tag to indicate the preferred version of this page'
      });
    } else {
      categories.metadata.score += 5;
    }
    
    // Heading checks (content)
    if (h1Elements.length === 0) {
      categories.content.issues.push({
        type: 'missing_h1',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Add an H1 heading to your page'
      });
    } else if (h1Elements.length > 1) {
      categories.content.issues.push({
        type: 'multiple_h1',
        severity: 'warning',
        impact: 'medium',
        current: h1Elements.length,
        recommendation: 'Use only one H1 heading per page'
      });
    } else {
      categories.content.score += 10;
    }
    
    if (h2Elements.length === 0) {
      categories.content.issues.push({
        type: 'missing_h2',
        severity: 'warning',
        impact: 'medium',
        recommendation: 'Add H2 headings to structure your content'
      });
    } else {
      categories.content.score += 5;
    }
    
    // Content length check (content)
    if (wordCount < 300) {
      categories.content.issues.push({
        type: 'thin_content',
        severity: 'warning',
        impact: 'high',
        current: wordCount,
        recommendation: 'Add more content to your page (aim for at least 300 words)'
      });
    } else if (wordCount >= 600) {
      categories.content.score += 15;
    } else if (wordCount >= 300) {
      categories.content.score += 10;
    }
    
    // Image alt text check (content)
    if (imagesWithoutAlt.length > 0) {
      categories.content.issues.push({
        type: 'images_missing_alt',
        severity: 'warning',
        impact: 'medium',
        count: imagesWithoutAlt.length,
        recommendation: 'Add alt text to all images for better accessibility and SEO'
      });
    } else if ($('img').length > 0) {
      categories.content.score += 5;
    }
    
    // Structured data check (technical)
    if (structuredData.length === 0) {
      categories.technical.issues.push({
        type: 'no_structured_data',
        severity: 'warning',
        impact: 'medium',
        recommendation: 'Add structured data to help search engines understand your content'
      });
    } else {
      categories.technical.score += 10;
    }
    
    // Mobile viewport check (technical & user experience)
    if (!hasMobileViewport) {
      categories.technical.issues.push({
        type: 'no_mobile_viewport',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Add a mobile viewport meta tag for proper mobile rendering'
      });
      
      categories.userExperience.issues.push({
        type: 'not_mobile_friendly',
        severity: 'critical',
        impact: 'high',
        recommendation: 'Make your page mobile-friendly with responsive design'
      });
    } else {
      categories.technical.score += 10;
      categories.userExperience.score += 10;
    }
    
    // Link quality check (technical)
    if (internalLinks.length === 0) {
      categories.technical.issues.push({
        type: 'no_internal_links',
        severity: 'warning',
        impact: 'medium',
        recommendation: 'Add internal links to improve site navigation and SEO'
      });
    } else {
      categories.technical.score += 5;
    }
    
    // User experience check for link count
    if (internalLinks.length + externalLinks.length > 100) {
      categories.userExperience.issues.push({
        type: 'excessive_links',
        severity: 'warning',
        impact: 'medium',
        current: internalLinks.length + externalLinks.length,
        recommendation: 'Consider reducing the number of links on the page for better user experience'
      });
    } else {
      categories.userExperience.score += 5;
    }
    
    // Calculate overall score with weights from requirement #14
    const metadataWeight = 0.20;
    const contentWeight = 0.35;
    const technicalWeight = 0.25;
    const userExperienceWeight = 0.20;
    
    // Normalize category scores
    categories.metadata.normalizedScore = categories.metadata.score / categories.metadata.maxScore;
    categories.content.normalizedScore = categories.content.score / categories.content.maxScore;
    categories.technical.normalizedScore = categories.technical.score / categories.technical.maxScore;
    categories.userExperience.normalizedScore = categories.userExperience.score / categories.userExperience.maxScore;
    
    // Calculate weighted score
    const overallScore = Math.round(
      (categories.metadata.normalizedScore * metadataWeight +
       categories.content.normalizedScore * contentWeight +
       categories.technical.normalizedScore * technicalWeight +
       categories.userExperience.normalizedScore * userExperienceWeight) * 100
    );
    
    // Total issues found
    const totalIssues = 
      categories.metadata.issues.length + 
      categories.content.issues.length + 
      categories.technical.issues.length + 
      categories.userExperience.issues.length;
    
    // Critical issues
    const criticalIssues = [
      ...categories.metadata.issues.filter(i => i.severity === 'critical'),
      ...categories.content.issues.filter(i => i.severity === 'critical'),
      ...categories.technical.issues.filter(i => i.severity === 'critical'),
      ...categories.userExperience.issues.filter(i => i.severity === 'critical')
    ];
    
    // Create analysis result - return a comprehensive object per requirements
    return {
      url,
      score: overallScore,
      criticalIssuesCount: criticalIssues.length,
      totalIssuesCount: totalIssues,
      categories: {
        metadata: {
          score: Math.round(categories.metadata.normalizedScore * 100),
          issues: categories.metadata.issues
        },
        content: {
          score: Math.round(categories.content.normalizedScore * 100),
          issues: categories.content.issues
        },
        technical: {
          score: Math.round(categories.technical.normalizedScore * 100),
          issues: categories.technical.issues
        },
        userExperience: {
          score: Math.round(categories.userExperience.normalizedScore * 100),
          issues: categories.userExperience.issues
        }
      },
      pageData: {
        title: {
          text: titleText,
          length: titleText.length
        },
        metaDescription: {
          text: metaDescription,
          length: metaDescription.length
        },
        headings: {
          h1Count: h1Elements.length,
          h1Texts: h1Texts.slice(0, 5), // First 5 H1 texts
          h2Count: h2Elements.length,
          h2Texts: h2Texts.slice(0, 5),  // First 5 H2 texts
          h3Count: h3Elements.length
        },
        content: {
          wordCount,
          contentLength
        },
        links: {
          internalCount: internalLinks.length,
          externalCount: externalLinks.length,
          totalCount: internalLinks.length + externalLinks.length
        },
        images: {
          total: $('img').length,
          withoutAlt: imagesWithoutAlt.length
        },
        technical: {
          hasCanonical: !!canonicalUrl,
          canonicalUrl,
          hasMobileViewport,
          hasStructuredData: structuredData.length > 0,
          structuredDataTypes: structuredData.map(item => item.type)
        }
      },
      recommendations: [
        ...criticalIssues.map(issue => ({
          priority: 'high',
          type: issue.type,
          description: issue.recommendation
        })),
        ...categories.metadata.issues
          .filter(i => i.severity !== 'critical')
          .map(issue => ({
            priority: issue.severity === 'warning' ? 'medium' : 'low',
            type: issue.type,
            description: issue.recommendation
          })),
        ...categories.content.issues
          .filter(i => i.severity !== 'critical')
          .map(issue => ({
            priority: issue.severity === 'warning' ? 'medium' : 'low',
            type: issue.type,
            description: issue.recommendation
          })),
        ...categories.technical.issues
          .filter(i => i.severity !== 'critical')
          .map(issue => ({
            priority: issue.severity === 'warning' ? 'medium' : 'low',
            type: issue.type,
            description: issue.recommendation
          })),
        ...categories.userExperience.issues
          .filter(i => i.severity !== 'critical')
          .map(issue => ({
            priority: issue.severity === 'warning' ? 'medium' : 'low',
            type: issue.type,
            description: issue.recommendation
          }))
      ],
      analyzedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error in page audit for ${url}:`, error);
    throw error;
  }
}

// Process site audit job
async function processSiteAudit(job) {
  const { url, options = {} } = job.params;
  const maxPages = Math.min(options.maxPages || 20, 100); // Default to 20 pages
  const crawlDepth = Math.min(options.depth || 3, 5);     // Default to depth 3
  
  // Add detailed logging
  console.log(`Starting site audit for ${url} with max pages: ${maxPages}, depth: ${crawlDepth}`);
  
  // Update progress
  await updateJob(job.id, {
    progress: 5,
    message: `Starting site crawl: max ${maxPages} pages, depth ${crawlDepth}`
  });
  
  try {
    // Track crawled URLs to avoid duplicates
    const crawledUrls = new Set();
    // Queue of URLs to crawl
    const urlQueue = [];
    // Store results for each page
    const pageResults = [];
    // Store issues for aggregation
    const allIssues = [];
    // Track domains we've crawled recently to prevent rate limiting
    const domainAccesses = new Map();
    
    // First, analyze the main page
    const mainPageResult = await processPageAudit({
      id: job.id + ':main',
      params: { url }
    });
    
    // Add main page to crawled set
    crawledUrls.add(url);
    pageResults.push({
      url,
      score: mainPageResult.score,
      title: mainPageResult.pageData.title.text,
      criticalIssuesCount: mainPageResult.criticalIssuesCount,
      totalIssuesCount: mainPageResult.totalIssuesCount,
      pageAnalysis: mainPageResult.pageData
    });
    
    // Add issues from main page to all issues
    Object.values(mainPageResult.categories).forEach(category => {
      allIssues.push(...category.issues);
    });
    
    // Extract links from main page and add to queue
    if (mainPageResult.pageData && mainPageResult.pageData.links) {
      const { internalCount, externalCount, totalCount } = mainPageResult.pageData.links;
      
      // If we have internal links data but not the actual URLs, we need to fetch them
      if (internalCount > 0 && !mainPageResult.pageData.links.internalUrls) {
        // In this case, re-fetch the page to extract actual link URLs
        try {
          const response = await axios.get(url, {
            timeout: 15000,
            headers: {
              'User-Agent': 'MardenSEOAuditBot/1.0'
            }
          });
          
          const $ = cheerio.load(response.data);
          
          // Extract all links
          $('a[href]').each((i, el) => {
            const href = $(el).attr('href');
            
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
              return;
            }
            
            try {
              const linkUrl = new URL(href, url);
              
              // Only add internal links to the queue
              if (linkUrl.hostname === new URL(url).hostname) {
                const normalizedLink = normalizeUrl(linkUrl.href);
                if (!crawledUrls.has(normalizedLink)) {
                  urlQueue.push({
                    url: normalizedLink,
                    depth: 1
                  });
                }
              }
            } catch (error) {
              // Skip malformed URLs
              console.warn(`Skipping malformed URL: ${href}`);
            }
          });
        } catch (error) {
          console.error(`Error fetching links from ${url}:`, error);
        }
      }
    }
    
    // Update progress
    await updateJob(job.id, {
      progress: 10,
      message: `Analyzed main page, found ${urlQueue.length} links to crawl`
    });
    
    console.log(`Analyzed main page ${url}, found ${urlQueue.length} links to crawl`);
    
    // Process queue with optimal batching for serverless environment
    // We'll process 3 pages at a time to avoid overwhelming the server
    const BATCH_SIZE = 3;
    
    // Function to normalize URL for consistency
    function normalizeUrl(inputUrl) {
      try {
        const parsedUrl = new URL(inputUrl);
        
        // Remove trailing slashes
        let path = parsedUrl.pathname;
        if (path.endsWith('/') && path.length > 1) {
          path = path.slice(0, -1);
        }
        
        // Remove common tracking parameters
        parsedUrl.searchParams.delete('utm_source');
        parsedUrl.searchParams.delete('utm_medium');
        parsedUrl.searchParams.delete('utm_campaign');
        
        // Reconstruct URL without fragments
        parsedUrl.pathname = path;
        parsedUrl.hash = '';
        
        return parsedUrl.toString();
      } catch (error) {
        return inputUrl;
      }
    }
    
    // Function to determine if we should throttle requests to a domain
    function shouldThrottle(inputUrl) {
      try {
        const domain = new URL(inputUrl).hostname;
        const now = Date.now();
        const lastAccess = domainAccesses.get(domain) || 0;
        
        // If accessed within the last 2 seconds, throttle
        if (now - lastAccess < 2000) {
          return true;
        }
        
        // Update last access time
        domainAccesses.set(domain, now);
        return false;
      } catch (error) {
        return false;
      }
    }
    
    // Process the queue until we've reached max pages or the queue is empty
    let currentStep = 1; // We already processed the main page
    
    for (let i = 0; i < urlQueue.length && crawledUrls.size < maxPages; i += BATCH_SIZE) {
      // Get a batch of URLs to process
      const batch = urlQueue.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}, URLs: ${batch.map(item => item.url).join(', ')}`);
      
      // Process each URL in the batch with individual error handling
      const batchPromises = batch.map(async ({ url: pageUrl, depth }) => {
        // Skip if we've already crawled this URL or reached max pages
        if (crawledUrls.has(pageUrl) || crawledUrls.size >= maxPages) {
          return null;
        }
        
        // Skip if depth exceeds the limit
        if (depth > crawlDepth) {
          return null;
        }
        
        // Check if we need to throttle
        if (shouldThrottle(pageUrl)) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        try {
          // Mark as crawled early to prevent duplicates
          crawledUrls.add(pageUrl);
          
          // Process the page
          const pageResult = await processPageAudit({
            id: `${job.id}:page${crawledUrls.size}`,
            params: { url: pageUrl }
          });
          
          // Add result to the list
          pageResults.push({
            url: pageUrl,
            score: pageResult.score,
            title: pageResult.pageData.title.text,
            criticalIssuesCount: pageResult.criticalIssuesCount,
            totalIssuesCount: pageResult.totalIssuesCount,
            pageAnalysis: pageResult.pageData
          });
          
          // Add issues from this page to all issues
          Object.values(pageResult.categories).forEach(category => {
            allIssues.push(...category.issues);
          });
          
          // Extract new links from this page and add to queue
          if (pageResult.pageData && pageResult.pageData.links) {
            const { internalCount } = pageResult.pageData.links;
            
            // If we have internal links data but not the actual URLs, we need to fetch them
            if (internalCount > 0 && depth < crawlDepth) {
              // Fetch the page to extract actual link URLs
              try {
                const response = await axios.get(pageUrl, {
                  timeout: 15000,
                  headers: {
                    'User-Agent': 'MardenSEOAuditBot/1.0'
                  }
                });
                
                const $ = cheerio.load(response.data);
                
                // Extract all links
                $('a[href]').each((i, el) => {
                  const href = $(el).attr('href');
                  
                  if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
                    return;
                  }
                  
                  try {
                    const linkUrl = new URL(href, pageUrl);
                    
                    // Only add internal links to the queue
                    if (linkUrl.hostname === new URL(url).hostname) {
                      const normalizedLink = normalizeUrl(linkUrl.href);
                      if (!crawledUrls.has(normalizedLink)) {
                        urlQueue.push({
                          url: normalizedLink,
                          depth: depth + 1
                        });
                      }
                    }
                  } catch (error) {
                    // Skip malformed URLs
                  }
                });
              } catch (error) {
                console.error(`Error fetching links from ${pageUrl}:`, error);
              }
            }
          }
          
          return pageResult;
        } catch (error) {
          console.error(`Error crawling ${pageUrl}:`, error);
          
          // Return error result instead of throwing
          return {
            url: pageUrl,
            score: 0,
            status: 'error',
            error: error.message || 'Failed to analyze URL'
          };
        }
      });
      
      // Wait for all promises in the batch
      await Promise.all(batchPromises.filter(Boolean));
      
      // Update progress
      currentStep += batch.length;
      await updateJob(job.id, {
        progress: Math.min(90, Math.round((currentStep / maxPages) * 100)),
        message: `Crawled ${crawledUrls.size}/${maxPages} pages`
      });
      
      console.log(`Completed batch, crawled ${crawledUrls.size}/${maxPages} pages so far`);
      
      // Add small delay between batches to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Update progress for aggregation
    await updateJob(job.id, {
      progress: 95,
      message: 'Aggregating site metrics'
    });
    
    console.log(`Site crawl completed, analyzed ${pageResults.length} pages`);
    
    // Aggregate data from all pages
    
    // Calculate average score
    const totalScore = pageResults.reduce((sum, page) => sum + page.score, 0);
    const averageScore = Math.round(totalScore / pageResults.length);
    
    // Find common issues
    const issueFrequency = {};
    
    allIssues.forEach(issue => {
      const issueType = issue.type;
      if (!issueFrequency[issueType]) {
        issueFrequency[issueType] = {
          type: issueType,
          frequency: 0,
          severity: issue.severity,
          impact: issue.impact,
          recommendation: issue.recommendation
        };
      }
      issueFrequency[issueType].frequency++;
    });
    
    // Sort issues by frequency
    const commonIssues = Object.values(issueFrequency)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10); // Top 10 issues
    
    // Calculate overall critical issues and total issues
    const totalCriticalIssues = pageResults.reduce((sum, page) => sum + page.criticalIssuesCount, 0);
    const totalIssuesCount = pageResults.reduce((sum, page) => sum + page.totalIssuesCount, 0);
    
    // Return site analysis with all page data
    return {
      url,
      pagesAnalyzed: pageResults.length,
      maxPages,
      crawlDepth,
      score: averageScore,
      criticalIssuesCount: totalCriticalIssues,
      totalIssuesCount: totalIssuesCount,
      siteAnalysis: {
        averageScore,
        commonIssues,
        pages: pageResults
      },
      analyzedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error in site audit for ${url}:`, error);
    throw error;
  }
}

// Process jobs from queue
async function processQueue() {
  try {
    // Get next job from queue
    const jobId = await getNextJob();
    
    if (jobId) {
      console.log(`Processing job ${jobId} from queue`);
      await processJob(jobId);
    }
    
    return jobId != null; // Return true if we processed a job
  } catch (error) {
    console.error('Error processing job queue:', error);
    return false;
  }
}

// Process multiple jobs in a batch
async function processBatch(batchSize = 5) {
  let processedCount = 0;
  let hasMore = true;
  
  // Process up to batchSize jobs
  while (hasMore && processedCount < batchSize) {
    hasMore = await processQueue();
    if (hasMore) {
      processedCount++;
    }
  }
  
  return processedCount;
}

module.exports = {
  processJob,
  processQueue,
  processBatch,
  processPageAudit,
  processSiteAudit
};