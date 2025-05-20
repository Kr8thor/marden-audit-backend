# Marden SEO Audit Tool - Railway Deployment Guide

This guide provides step-by-step instructions for deploying the Marden SEO Audit Tool to Railway.

## Prerequisites

1. [Node.js](https://nodejs.org/) v16+ installed
2. [Railway CLI](https://docs.railway.app/develop/cli) installed
3. Railway account with access to the project
4. Git installed

## Step 1: Initial Setup (First-time only)

### Backend Setup

```bash
# Clone the repository (if not already done)
git clone https://github.com/Kr8thor/marden-audit-backend.git
cd marden-audit-backend

# Install dependencies
npm install

# Login to Railway
railway login

# Link to the project (first-time setup)
railway init
# OR
railway link
```

### Frontend Setup

```bash
# Clone the repository (if not already done)
git clone https://github.com/Kr8thor/marden-audit-reimagined.git
cd marden-audit-reimagined

# Install dependencies
npm install

# Login to Railway
railway login

# Link to the project (first-time setup)
railway init
# OR
railway link
```

## Step 2: Deployment Process

### Backend Deployment

```bash
# Navigate to backend directory
cd marden-audit-backend

# Ensure you're on the master branch
git checkout master

# Pull latest changes
git pull

# Deploy to Railway
./deploy.sh
# OR
railway up
```

### Frontend Deployment

```bash
# Navigate to frontend directory
cd marden-audit-reimagined

# Ensure you're on the main branch
git checkout main

# Pull latest changes
git pull

# Deploy to Railway
./deploy.sh --railway
# OR
railway up
```

## Step 3: Verify Deployment

### Backend Verification

1. Check the Railway deployment status:
   ```bash
   railway status
   ```

2. Test the health endpoint:
   ```bash
   curl https://marden-audit-backend-production.up.railway.app/health
   ```

3. Verify Redis connectivity in the health response.

### Frontend Verification

1. Check the Railway deployment status:
   ```bash
   railway status
   ```

2. Visit the frontend URL:
   - Railway: https://marden-audit-reimagined-production.up.railway.app
   - Production: https://audit.mardenseo.com

3. Test basic functionality by submitting a URL for analysis.

## Environment Variables

### Backend Environment Variables

```
NODE_ENV=production
PORT=3000
MAX_CONCURRENCY=3
MAX_MEMORY_PERCENT=80
CORS_ORIGIN=https://audit.mardenseo.com,http://localhost:9090
UPSTASH_REDIS_REST_URL=https://smiling-shrimp-21387.upstash.io
UPSTASH_REDIS_REST_TOKEN=AVOLAAIjcDFmNzVjNDVjZGM3MGY0NDczODEyMTA0NTAyOGNkMTc5OXAxMA
NODE_OPTIONS=--max-old-space-size=256
```

### Frontend Environment Variables

```
VITE_API_URL=https://marden-audit-backend-production.up.railway.app
VITE_API_FALLBACK_URL=https://marden-seo-audit-api.vercel.app
PORT=9090
NODE_ENV=production
```

## Troubleshooting

### Redis Connection Issues

If Redis connection fails:

1. Verify Upstash credentials in environment variables
2. Test Redis connection:
   ```bash
   cd marden-audit-backend
   node test-redis.js
   ```
3. Check Redis status via health endpoint

### Memory Usage Issues

If memory usage is high:

1. Check memory stats via health endpoint
2. Adjust `MAX_MEMORY_PERCENT` if needed
3. Consider reducing `MAX_CONCURRENCY`

### Deployment Failures

If deployment fails:

1. Check Railway logs:
   ```bash
   railway logs
   ```
2. Verify all required environment variables are set
3. Check for syntax errors in code

## Maintenance

### Weekly Tasks

1. Monitor error logs: `railway logs --error`
2. Check Redis connectivity 
3. Monitor memory usage patterns
4. Validate cache efficiency

### Monthly Tasks

1. Update dependencies: `npm update`
2. Perform security audit: `npm audit`
3. Review performance metrics
4. Check for outdated cache entries

---

Last updated: May 20, 2025
