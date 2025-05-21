# Marden SEO Audit Tool - Backend

This repository contains the backend API for the Marden SEO Audit Tool, optimized for deployment on Railway with enhanced SEO analysis capabilities.

## Features

- Comprehensive SEO analysis
- Structured data (schema.org) validation
- Mobile-friendliness analysis
- Full site crawling with Crawl4AI integration
- Memory-optimized for Railway deployment
- Two-tier caching (memory + Redis)
- Concurrency control
- API consolidation
- Error handling with graceful degradation

## Local Development

1. **Installation**

```bash
# Clone the repository
git clone https://github.com/Kr8thor/marden-audit-backend.git
cd marden-audit-backend

# Install dependencies
npm install
```

2. **Environment Setup**

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit the `.env` file and add your Upstash Redis credentials if available.

3. **Start the development server**

```bash
npm run dev
```

This will start the server in development mode with nodemon for auto-reloading.

4. **Testing**

Test the API with:

```bash
# Basic health check
curl http://localhost:3000/health

# Basic SEO analysis
curl http://localhost:3000/seo-analyze?url=https://example.com

# Schema.org markup analysis
curl http://localhost:3000/schema-analyze?url=https://example.com

# Mobile-friendliness analysis
curl http://localhost:3000/mobile-analyze?url=https://example.com

# Enhanced analysis (POST request)
curl -X POST -H "Content-Type: application/json" -d '{"url":"https://example.com","options":{"mobileAnalysis":true,"schemaAnalysis":true}}' http://localhost:3000/enhanced-seo-analyze
```

5. **Testing the enhanced features**

You can run the enhanced features test:

```bash
node test-enhanced.js
```

## Deployment on Railway

### Prerequisites

- [Railway CLI](https://docs.railway.app/develop/cli) installed
- Railway account

### Steps

1. **Login to Railway**

```bash
railway login
```

2. **Initialize a new project (first time only)**

```bash
railway init
```

3. **Link existing project (if already created)**

```bash
railway link
```

4. **Set environment variables**

Set the following environment variables in the Railway dashboard:

- `PORT`: 3000
- `NODE_ENV`: production
- `UPSTASH_REDIS_REST_URL`: From Upstash dashboard
- `UPSTASH_REDIS_REST_TOKEN`: From Upstash dashboard
- `MAX_CONCURRENCY`: 3
- `CORS_ORIGIN`: comma-separated list of allowed origins

5. **Deploy**

```bash
# Windows
deploy.bat

# Linux/Mac
./deploy.sh

# Alternatively
railway up
```

6. **Verify Deployment**

Navigate to your Railway dashboard to confirm successful deployment and check the health endpoint:

```bash
curl https://[your-railway-url]/health
```

## API Endpoints

### Health Check

```
GET /health
```

Returns the health status of the API and its components.

### SEO Analysis

```
GET /seo-analyze?url=https://example.com
POST /seo-analyze
```

Performs a comprehensive SEO analysis of the provided URL.

### Basic Audit

```
GET /basic-audit?url=https://example.com
POST /basic-audit
```

Alias for SEO analysis.

### Schema Analysis (New)

```
GET /schema-analyze?url=https://example.com
```

Analyzes structured data (schema.org markup) on a webpage.

### Mobile-Friendliness Analysis (New)

```
GET /mobile-analyze?url=https://example.com
```

Analyzes mobile-friendliness factors for a webpage.

### Enhanced SEO Analysis (New)

```
POST /enhanced-seo-analyze
```

Performs comprehensive SEO analysis with multiple components (mobile-friendliness, schema validation, and optionally site crawling).

For full API documentation, see [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

## Configuration

### Memory Management

The application is configured to use a maximum of 256MB of memory, optimized for Railway's resource limits.

### Concurrency Control

By default, the application allows 3 concurrent requests, with additional requests being queued.

### Caching

The application uses a two-tier caching strategy:
- Memory cache: 1 hour TTL
- Redis cache: 24 hours TTL

## Enhanced Features

### Schema Validator

- Detects JSON-LD and Microdata formats
- Validates schema according to schema.org requirements
- Provides recommendations for improved implementation
- Supports multiple schema types (Organization, Product, WebPage, etc.)

### Mobile-Friendly Analyzer

- Checks viewport configuration
- Evaluates tap target sizes
- Detects horizontal scrolling issues
- Analyzes responsive design elements
- Identifies mobile compatibility issues

### Crawl4AI Integration

- Multi-page site crawling
- Configurable crawl depth and limits
- Cross-page issue aggregation
- Performance metrics collection

## Monitoring

Monitor the application's health and performance through:
- Railway dashboard
- `/health` endpoint
- Application logs

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Proprietary - All rights reserved