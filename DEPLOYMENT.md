# Marden SEO Audit Tool - Railway Deployment Guide

This document outlines the process for deploying the Marden SEO Audit Tool backend and frontend on Railway's Hobby Plan.

## Prerequisites

1. Railway CLI installed and authenticated
2. Node.js and npm installed locally
3. Access to both repositories:
   - Backend: `https://github.com/Kr8thor/marden-audit-backend`
   - Frontend: `https://github.com/Kr8thor/marden-audit-reimagined`

## Backend Deployment

The backend uses optimized code with concurrency control and two-tier caching to stay within Railway's Hobby plan constraints.

### Step 1: Clone and Configure

```bash
git clone https://github.com/Kr8thor/marden-audit-backend.git
cd marden-audit-backend
```

### Step 2: Set Up Redis (Upstash)

1. Create an Upstash Redis instance
2. Note the REST URL and token
3. Update `.env.railway` file with your Redis credentials

### Step 3: Deploy to Railway

Run the deployment script:

```bash
./deploy-railway.bat  # Windows
# or
./deploy-railway.sh   # Linux/Mac
```

This script:
- Copies optimized implementations into production files
- Configures environment variables
- Deploys to Railway with proper resource constraints

### Step 4: Verify Deployment

```bash
railway status
```

Test the health endpoint:
```
https://your-backend-url.railway.app/health
```

## Frontend Deployment

### Step 1: Clone and Configure

```bash
git clone https://github.com/Kr8thor/marden-audit-reimagined.git
cd marden-audit-reimagined
```

### Step 2: Update API URL

Edit `.env.railway` to point to your deployed backend:

```
VITE_API_URL=https://your-backend-url.railway.app
```

### Step 3: Deploy to Railway

Run the deployment script:

```bash
./deploy-railway.bat  # Windows
# or
./deploy-railway.sh   # Linux/Mac
```

### Step 4: Verify Deployment

```bash
railway status
```

Test the frontend:
```
https://your-frontend-url.railway.app
```

## Monitoring and Maintenance

### Health Checks

- Backend: `/health` endpoint provides comprehensive diagnostics
- Frontend: `/health` endpoint confirms service is running

### Memory Usage

The backend is configured with a 256MB memory limit and includes automatic garbage collection during idle periods.

### Concurrency Control

The backend limits concurrent requests to 3 (configurable via `MAX_CONCURRENCY` env var) with a maximum queue size of 10.

### Caching Strategy

Two-tier caching is implemented:
- Memory cache (TTL: 1 hour, 100 entries max)
- Redis cache (TTL: 24 hours)

## Troubleshooting

### Memory Issues

If you see "Memory usage high" warnings in logs:

1. Check `/status` endpoint for current memory usage
2. Consider:
   - Decreasing the `MAX_CONCURRENCY` value
   - Increasing garbage collection frequency

### API Timeout Issues

If API requests are timing out:

1. Check Redis connection (slow Redis can cause delays)
2. Verify the rate of incoming requests isn't overwhelming the server
3. Consider adjusting `ANALYSIS_TIMEOUT` in environment variables

### CORS Issues

If frontend can't connect to backend:

1. Verify the backend CORS configuration includes the frontend URL
2. Check for any network restrictions in Railway
3. Ensure `VITE_API_URL` is correctly set in frontend

## Environment Variables Reference

### Backend

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (production/development)
- `UPSTASH_REDIS_REST_URL`: Redis REST API URL
- `UPSTASH_REDIS_REST_TOKEN`: Redis REST API token
- `CORS_ORIGIN`: Comma-separated list of allowed origins
- `MAX_CONCURRENCY`: Maximum concurrent requests (default: 3)
- `MAX_MEMORY_PERCENT`: Memory threshold for warnings (default: 80)
- `REDIS_TIMEOUT`: Redis request timeout in ms (default: 2000)
- `ANALYSIS_TIMEOUT`: SEO analysis timeout in ms (default: 15000)

### Frontend

- `PORT`: Server port (default: 9090)
- `NODE_ENV`: Environment (production/development)
- `VITE_API_URL`: Backend API URL
