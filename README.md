# Marden SEO Audit Backend

This is the backend API for the Marden SEO Audit Tool. It provides endpoints for analyzing websites for SEO best practices and generates detailed reports.

## API Endpoints

- `/api/health` - Check the health of the API and Redis connection
- `/api/basic-audit` - Perform a detailed SEO audit of a URL

## Features

- **Real-time SEO Analysis**: Analyzes websites in real-time for SEO issues
- **Redis Caching**: Caches results to improve performance and stay within Vercel limits
- **Comprehensive Checks**: Analyzes titles, meta descriptions, headings, content, images, links, and more
- **Vercel Deployment**: Optimized for Vercel serverless functions

## Consolidated API Architecture

To stay within Vercel's 12 function limit on the Hobby plan, this API uses a consolidated approach:

- A single API endpoint (`api/index.js`) handles multiple routes
- Routes are determined by URL parameters
- All SEO analysis logic is contained in one file to reduce function count

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with Redis credentials
4. Start the dev server: `npm run dev`

## Deployment

The API is deployed to Vercel. To deploy:

```
vercel
```

Or to deploy to production:

```
vercel --prod
```

## Environment Variables

- `UPSTASH_REDIS_REST_URL`: URL for Redis connection
- `UPSTASH_REDIS_REST_TOKEN`: Token for Redis authentication
