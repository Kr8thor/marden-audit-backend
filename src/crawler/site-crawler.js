/**
 * Site Crawler for Marden SEO Audit
 * Discovers pages within a website respecting robots.txt and performance constraints
 */
const axios = require('axios');
const cheerio = require('cheerio');
const url = require('url');
const { parse: parseRobots } = require('robots-parser');
const { URL } = require('url');

/**
 * Site Crawler with performance and memory optimization
 */
class SiteCrawler {
  constructor(options = {}) {
    this.maxPages = options.maxPages || 50;
    this.maxDepth = options.maxDepth || 3;
    this.concurrency = options.concurrency || 5;
    this.timeout = options.timeout || 10000;
    this.includeMedia = options.includeMedia || false;
    this.respectRobots = options.respectRobots !== false;
    
    // Track discovered URLs and their statuses
    this.discoveredUrls = new Map();
    this.pendingUrls = [];
    this.crawledUrls = [];
    this.failedUrls = [];
    
    // Track site structure
    this.siteStructure = {
      nodes: [],
      edges: []
    };
    
    // Robots.txt parser
    this.robotsParser = null;
    
    // Tracking state
    this.activeCrawls = 0;
    this.startTime = null;
    this.endTime = null;
    this.stopped = false;
  }
  
  /**
   * Initialize crawler with a starting URL
   * @param {string} startUrl URL to start crawling from
   */
  async initialize(startUrl) {
    try {
      // Normalize the start URL
      const parsedUrl = new URL(startUrl);
      this.startUrl = parsedUrl.origin;
      this.baseDomain = parsedUrl.hostname;
      
      // Create a robots.txt URL
      const robotsUrl = `${parsedUrl.origin}/robots.txt`;
      
      // Try to fetch and parse robots.txt
      if (this.respectRobots) {
        try {
          console.log(`Fetching robots.txt from ${robotsUrl}`);
          const robotsResponse = await axios.get(robotsUrl, { 
            timeout: this.timeout,
            headers: {
              'User-Agent': 'MardenSEOAuditBot/1.0'
            }
          });
          
          if (robotsResponse.status === 200) {
            this.robotsParser = parseRobots(robotsUrl, robotsResponse.data);
            console.log('Robots.txt parsed successfully');
          }
        } catch (error) {
          console.log(`No robots.txt found or error fetching it: ${error.message}`);
          // Continue without robots.txt
        }
      }
      
      // Add the start URL to pending
      this.addUrlToPending(startUrl, null, 0);
      
      return true;
    } catch (error) {
      console.error(`Initialization error: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Check if a URL is allowed to be crawled
   * @param {string} url URL to check
   * @returns {boolean} Whether URL is allowed to be crawled
   */
  isUrlAllowed(url) {
    // Check if URL is from the same domain
    try {
      const parsedUrl = new URL(url);
      
      // Skip non-HTTP protocols
      if (!parsedUrl.protocol.startsWith('http')) {
        return false;
      }
      
      // Skip if not on the same domain
      if (parsedUrl.hostname !== this.baseDomain) {
        return false;
      }
      
      // Skip media files unless explicitly included
      if (!this.includeMedia) {
        const extension = parsedUrl.pathname.split('.').pop().toLowerCase();
        const mediaExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'mp4', 'webm', 'mp3', 'wav'];
        if (mediaExtensions.includes(extension)) {
          return false;
        }
      }
      
      // Check robots.txt if available
      if (this.robotsParser) {
        const isAllowed = this.robotsParser.isAllowed(url, 'MardenSEOAuditBot/1.0');
        if (!isAllowed) {
          console.log(`URL ${url} disallowed by robots.txt`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.warn(`Error parsing URL ${url}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Add a URL to the pending queue if it's new
   * @param {string} url URL to add
   * @param {string|null} sourceUrl URL that linked to this URL
   * @param {number} depth Crawl depth
   */
  addUrlToPending(url, sourceUrl, depth) {
    // Skip if we already know about this URL
    if (this.discoveredUrls.has(url)) {
      // Update the edge if source is provided
      if (sourceUrl) {
        this.addEdge(sourceUrl, url);
      }
      return;
    }
    
    // Skip if URL is not allowed
    if (!this.isUrlAllowed(url)) {
      return;
    }
    
    // Skip if we've reached the maximum depth
    if (depth > this.maxDepth) {
      return;
    }
    
    // Add to discovered URLs
    this.discoveredUrls.set(url, {
      status: 'pending',
      depth,
      discoveredAt: Date.now()
    });
    
    // Add to pending queue
    this.pendingUrls.push({
      url,
      depth
    });
    
    // Create node in site structure
    this.addNode(url);
    
    // Create edge in site structure if source is provided
    if (sourceUrl) {
      this.addEdge(sourceUrl, url);
    }
    
    console.log(`Added URL to queue: ${url} (depth ${depth})`);
  }
  
  /**
   * Add a node to the site structure
   * @param {string} url URL to add as node
   */
  addNode(url) {
    // Check if node already exists
    const existingNode = this.siteStructure.nodes.find(node => node.id === url);
    if (!existingNode) {
      this.siteStructure.nodes.push({
        id: url,
        label: this.getLabelFromUrl(url)
      });
    }
  }
  
  /**
   * Add an edge to the site structure
   * @param {string} source Source URL
   * @param {string} target Target URL
   */
  addEdge(source, target) {
    // Check if edge already exists
    const existingEdge = this.siteStructure.edges.find(edge => 
      edge.source === source && edge.target === target);
    
    if (!existingEdge) {
      this.siteStructure.edges.push({
        source,
        target
      });
    }
  }
  
  /**
   * Extract a human-readable label from a URL
   * @param {string} urlString URL to extract label from
   * @returns {string} Human-readable label
   */
  getLabelFromUrl(urlString) {
    try {
      const parsedUrl = new URL(urlString);
      
      // For the homepage, use a special label
      if (parsedUrl.pathname === '/' || parsedUrl.pathname === '') {
        return 'Homepage';
      }
      
      // Extract the last part of the path
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      if (pathParts.length === 0) {
        return 'Homepage';
      }
      
      let label = pathParts[pathParts.length - 1];
      
      // Remove file extensions
      label = label.replace(/\.[^.]+$/, '');
      
      // Replace hyphens and underscores with spaces
      label = label.replace(/[-_]/g, ' ');
      
      // Capitalize first letter
      label = label.charAt(0).toUpperCase() + label.slice(1);
      
      return label;
    } catch (error) {
      return urlString;
    }
  }
  
  /**
   * Process a URL by fetching and parsing it
   * @param {string} url URL to process
   * @param {number} depth Current crawl depth
   */
  async processUrl(url, depth) {
    try {
      console.log(`Processing URL: ${url} (depth ${depth})`);
      
      // Update URL status to crawling
      this.discoveredUrls.set(url, {
        ...this.discoveredUrls.get(url),
        status: 'crawling'
      });
      
      // Fetch the URL
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'MardenSEOAuditBot/1.0',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        maxContentLength: 5 * 1024 * 1024 // 5MB max
      });
      
      // Skip non-HTML responses
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('text/html')) {
        console.log(`Skipping non-HTML content type: ${contentType} for ${url}`);
        
        // Mark as crawled but skip parsing
        this.discoveredUrls.set(url, {
          ...this.discoveredUrls.get(url),
          status: 'crawled',
          statusCode: response.status,
          contentType,
          crawledAt: Date.now()
        });
        
        this.crawledUrls.push(url);
        return;
      }
      
      // Parse the HTML
      const $ = cheerio.load(response.data);
      
      // Extract page metadata
      const title = $('title').text().trim();
      const metaDescription = $('meta[name="description"]').attr('content') || '';
      const h1 = $('h1').first().text().trim();
      
      // Update node with metadata
      const nodeIndex = this.siteStructure.nodes.findIndex(node => node.id === url);
      if (nodeIndex !== -1) {
        this.siteStructure.nodes[nodeIndex] = {
          ...this.siteStructure.nodes[nodeIndex],
          title,
          description: metaDescription,
          h1
        };
      }
      
      // Update discovered URL with metadata
      this.discoveredUrls.set(url, {
        ...this.discoveredUrls.get(url),
        status: 'crawled',
        statusCode: response.status,
        contentType,
        title,
        metaDescription,
        h1,
        crawledAt: Date.now()
      });
      
      // Add URL to crawled list
      this.crawledUrls.push(url);
      
      // Extract links if we haven't reached max depth
      if (depth < this.maxDepth) {
        // Extract links
        const links = new Set();
        $('a[href]').each((i, el) => {
          const href = $(el).attr('href');
          if (href) {
            try {
              // Resolve relative URLs
              const absoluteUrl = new URL(href, url).href;
              links.add(absoluteUrl);
            } catch (error) {
              // Skip invalid URLs
            }
          }
        });
        
        // Queue discovered links with higher depth
        for (const link of links) {
          this.addUrlToPending(link, url, depth + 1);
        }
      }
    } catch (error) {
      console.error(`Error processing ${url}: ${error.message}`);
      
      // Update URL status to failed
      this.discoveredUrls.set(url, {
        ...this.discoveredUrls.get(url),
        status: 'failed',
        error: error.message,
        failedAt: Date.now()
      });
      
      // Add to failed URLs
      this.failedUrls.push(url);
    }
  }
  
  /**
   * Start the crawling process
   * @returns {Promise<Object>} Crawl results
   */
  async crawl() {
    this.startTime = Date.now();
    this.stopped = false;
    console.log(`Starting crawl from ${this.startUrl}`);
    
    try {
      // Process URLs until we reach the maximum or run out
      while (
        this.pendingUrls.length > 0 && 
        this.crawledUrls.length < this.maxPages && 
        !this.stopped
      ) {
        // Process up to concurrency limit
        const batch = [];
        while (
          batch.length < this.concurrency && 
          this.pendingUrls.length > 0 && 
          this.crawledUrls.length + batch.length < this.maxPages
        ) {
          batch.push(this.pendingUrls.shift());
        }
        
        if (batch.length === 0) {
          break;
        }
        
        console.log(`Processing batch of ${batch.length} URLs. Crawled so far: ${this.crawledUrls.length}`);
        
        // Process batch in parallel
        await Promise.all(batch.map(item => this.processUrl(item.url, item.depth)));
      }
      
      this.endTime = Date.now();
      
      // Generate crawl results
      const crawlResults = {
        startUrl: this.startUrl,
        baseDomain: this.baseDomain,
        crawlDuration: this.endTime - this.startTime,
        pagesDiscovered: this.discoveredUrls.size,
        pagesCrawled: this.crawledUrls.length,
        pagesFailed: this.failedUrls.length,
        pagesSkipped: this.discoveredUrls.size - this.crawledUrls.length - this.failedUrls.length,
        maxDepthReached: Math.max(...Array.from(this.discoveredUrls.values()).map(info => info.depth || 0)),
        crawlSummary: {
          urlsPerStatus: {
            crawled: this.crawledUrls.length,
            failed: this.failedUrls.length,
            pending: this.pendingUrls.length
          },
          urlsByDepth: this.getCrawledUrlsByDepth()
        },
        siteStructure: this.siteStructure,
        crawledPages: Array.from(this.discoveredUrls.entries())
          .filter(([url, info]) => info.status === 'crawled')
          .map(([url, info]) => ({
            url,
            title: info.title || '',
            metaDescription: info.metaDescription || '',
            h1: info.h1 || '',
            depth: info.depth,
            statusCode: info.statusCode
          })),
        timestamp: new Date().toISOString()
      };
      
      console.log(`Crawl completed. Discovered ${crawlResults.pagesDiscovered} pages, crawled ${crawlResults.pagesCrawled}`);
      
      return crawlResults;
    } catch (error) {
      console.error(`Crawl error: ${error.message}`);
      this.endTime = Date.now();
      
      return {
        startUrl: this.startUrl,
        baseDomain: this.baseDomain,
        error: error.message,
        crawlDuration: this.endTime - this.startTime,
        pagesDiscovered: this.discoveredUrls.size,
        pagesCrawled: this.crawledUrls.length,
        pagesFailed: this.failedUrls.length,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Stop the crawling process
   */
  stop() {
    this.stopped = true;
    console.log('Crawl stopped by request');
  }
  
  /**
   * Get crawled URLs grouped by depth
   * @returns {Object} URLs by depth
   */
  getCrawledUrlsByDepth() {
    const urlsByDepth = {};
    
    for (const [url, info] of this.discoveredUrls.entries()) {
      if (info.status === 'crawled') {
        const depth = info.depth || 0;
        urlsByDepth[depth] = urlsByDepth[depth] || [];
        urlsByDepth[depth].push(url);
      }
    }
    
    return urlsByDepth;
  }
  
  /**
   * Get a summary of the crawl status
   * @returns {Object} Crawl status summary
   */
  getStatus() {
    return {
      discovered: this.discoveredUrls.size,
      crawled: this.crawledUrls.length,
      failed: this.failedUrls.length,
      pending: this.pendingUrls.length,
      running: !this.stopped && this.pendingUrls.length > 0,
      startTime: this.startTime,
      duration: this.startTime ? Date.now() - this.startTime : 0
    };
  }
}

module.exports = SiteCrawler;
