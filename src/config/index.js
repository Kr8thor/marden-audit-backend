import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

// Configuration object
const config = {
  // Server settings
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  
  // Upstash Redis settings
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  },
  
  // Crawling settings
  crawler: {
    maxPages: parseInt(process.env.MAX_PAGES_PER_CRAWL || '20', 10), // Default changed from 100 to 20
    depth: parseInt(process.env.CRAWL_DEPTH || '3', 10),
    timeout: parseInt(process.env.CRAWL_TIMEOUT || '30000', 10),
    userAgent: process.env.USER_AGENT || 'Marden SEO Audit Bot',
  },
  
  // Job queue settings
  queue: {
    processingInterval: parseInt(process.env.JOB_PROCESSING_INTERVAL || '10000', 10),
    batchSize: parseInt(process.env.BATCH_SIZE || '5', 10),
    jobTimeout: parseInt(process.env.JOB_TIMEOUT || '600000', 10),
  },
  
  // Analysis settings
  analysis: {
    pageSpeedApiKey: process.env.PAGESPEED_API_KEY,
  },
  
  // Paths
  paths: {
    root: rootDir,
  },
  
  // Queue and job key prefixes
  keys: {
    jobPrefix: 'job:',
    queueKey: 'audit:queue',
    processingQueueKey: 'audit:processing',
  },
};

export default config;