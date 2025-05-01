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
        error: `Unknown job type: ${job.type}`
      });
      return false;
    }
    
    // Update job with results
    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      results: result,
      completed: Date.now()
    });
    
    // Cache results
    if (job.type === 'page_audit') {
      await cacheData(
        'page', 
        job.params.url, 
        result,
        3600  // Cache for 1 hour
      );
    } else if (job.type === 'site_audit') {
      await cacheData(
        'site', 
        `${job.params.url}:max${job.params.options.maxPages}:depth${job.params.options.crawlDepth}`, 
        result,
        14400  // Cache for 4 hours
      );
    }
    
    return true;
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    await updateJob(jobId, {
      status: 'failed',
      error: error.message
    });
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
  
  // Fetch page
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
  
  // Extract SEO elements
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
  
  // Update progress
  await updateJob(job.id, {
    progress: 80,
    message: 'Calculating score'
  });
  
  // Calculate score
  let score = 100;
  let issuesFound = 0;
  
  // Title checks
  if (!titleText) {
    score -= 25;
    issuesFound++;
  } else if (titleText.length < 30) {
    score -= 10;
    issuesFound++;
  } else if (titleText.length > 60) {
    score -= 5;
    issuesFound++;
  }
  
  // Meta description checks
  if (!metaDescription) {
    score -= 15;
    issuesFound++;
  } else if (metaDescription.length < 50) {
    score -= 10;
    issuesFound++;
  } else if (metaDescription.length > 160) {
    score -= 5;
    issuesFound++;
  }
  
  // Heading checks
  if (h1Elements.length === 0) {
    score -= 15;
    issuesFound++;
  } else if (h1Elements.length > 1) {
    score -= 10;
    issuesFound++;
  }
  
  if (h2Elements.length === 0) {
    score -= 5;
    issuesFound++;
  }
  
  // Image alt text checks
  if (imagesWithoutAlt.length > 0) {
    score -= Math.min(15, imagesWithoutAlt.length * 3);
    issuesFound++;
  }
  
  // Content length check
  if (contentLength < 300) {
    score -= 10;
    issuesFound++;
  }
  
  // Canonical check
  if (!canonicalUrl) {
    score -= 5;
    issuesFound++;
  }
  
  // Ensure score stays within 0-100 range
  score = Math.max(0, Math.min(100, score));
  
  // Create analysis result
  return {
    url,
    score,
    issuesFound,
    opportunities: Math.max(0, issuesFound - 1),
    pageAnalysis: {
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
      links: {
        internalCount: internalLinks.length,
        externalCount: externalLinks.length,
        totalCount: internalLinks.length + externalLinks.length
      },
      images: {
        withoutAltCount: imagesWithoutAlt.length
      },
      contentLength,
      canonical: canonicalUrl,
      hreflang: hreflangLinks
    }
  };
}

// Process site audit job (simplified implementation)
async function processSiteAudit(job) {
  const { url, options } = job.params;
  const { maxPages, crawlDepth } = options;
  
  // Update progress
  await updateJob(job.id, {
    progress: 20,
    message: `Crawling site - max ${maxPages} pages, depth ${crawlDepth}`
  });
  
  // For now, just do a simple page audit as placeholder
  // A real implementation would crawl the site and analyze multiple pages
  const pageResult = await processPageAudit({
    id: job.id,
    params: { url }
  });
  
  // Update progress
  await updateJob(job.id, {
    progress: 80,
    message: 'Aggregating site metrics'
  });
  
  // Return site analysis (simplified for now)
  return {
    url,
    pagesAnalyzed: 1,
    maxPages,
    crawlDepth,
    score: pageResult.score,
    issuesFound: pageResult.issuesFound,
    opportunities: pageResult.opportunities,
    siteAnalysis: {
      averageScore: pageResult.score,
      commonIssues: [
        {
          type: 'missing_meta_description',
          frequency: pageResult.pageAnalysis.metaDescription.text ? 0 : 1,
          severity: 'critical'
        },
        {
          type: 'missing_h1',
          frequency: pageResult.pageAnalysis.headings.h1Count ? 0 : 1,
          severity: 'critical'
        },
        {
          type: 'multiple_h1',
          frequency: pageResult.pageAnalysis.headings.h1Count > 1 ? 1 : 0,
          severity: 'warning'
        },
        {
          type: 'missing_alt_text',
          frequency: pageResult.pageAnalysis.images.withoutAltCount,
          severity: 'warning'
        }
      ],
      pages: [
        {
          url,
          score: pageResult.score,
          title: pageResult.pageAnalysis.title.text,
          issuesFound: pageResult.issuesFound
        }
      ]
    }
  };
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