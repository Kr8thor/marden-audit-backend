# Marden SEO Audit Tool - Backend

This repository contains the backend API for the Marden SEO Audit Tool, optimized for deployment on Railway.

## Features

- Comprehensive SEO analysis
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
curl http://localhost:3000/health
curl http://localhost:3000/seo-analyze?url=https://example.com
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

Navigate to your Railway dashboard to confirm successful deployment.

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

## Configuration

### Memory Management

The application is configured to use a maximum of 256MB of memory, optimized for Railway's resource limits.

### Concurrency Control

By default, the application allows 3 concurrent requests, with additional requests being queued.

### Caching

The application uses a two-tier caching strategy:
- Memory cache: 1 hour TTL
- Redis cache: 24 hours TTL

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
