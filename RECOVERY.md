# Marden SEO Audit Tool Recovery & Deployment Guide

This document outlines the steps to restore and deploy the Marden SEO Audit Tool with Redis/Upstash integration on Railway.

## System Architecture

The Marden SEO Audit Tool consists of:

1. **Frontend** - React application deployed on Railway
2. **Backend** - Node.js API deployed on Railway
3. **Redis Cache** - Upstash Redis for caching audit results

## Prerequisites

- Node.js 16+
- Railway CLI installed globally (`npm install -g @railway/cli`)
- Upstash Redis account with REST API credentials
- GitHub access to the repositories

## Configuration Files

The system uses several configuration files:

- `.env` - Development environment variables
- `.env.railway` - Railway-specific environment variables
- `.env.production` - Production environment variables
- `railway.json` - Railway deployment configuration
- `Dockerfile` - Container configuration
- `package.json` - Dependencies and scripts

## Redis Integration

Redis integration is implemented via Upstash REST API. The key configuration parameters are:

- `UPSTASH_REDIS_REST_URL` - Upstash Redis URL
- `UPSTASH_REDIS_REST_TOKEN` - Upstash authentication token

These must be properly set in both the local and Railway environments.

## Recovery Steps

1. **Test Redis Connection**

Run the Redis test script to ensure connectivity:

```bash
node test-redis.js
```

2. **Start Backend Locally**

Run the backend API server:

```bash
npm run dev
```

3. **Test API Functionality**

Run the comprehensive test script:

```bash
node test-all.js
```

4. **Deploy to Railway**

Deploy the backend service to Railway:

```bash
npm run deploy
```

5. **Verify Deployment**

Check the deployment status on Railway dashboard and test endpoints.

6. **Verify Frontend Integration**

Ensure the frontend is configured to use the Railway backend URL.

## Maintenance Tasks

Regular maintenance tasks to ensure optimal performance:

1. **Monitor Memory Usage**

The system is configured with a 256MB memory limit. Monitor memory usage via:

```
GET /status
```

2. **Check Redis Health**

Redis health can be verified via:

```
GET /health
```

3. **Clear Redis Cache**

For issues with cached data, clear Redis cache using Upstash dashboard.

4. **Optimize Concurrency**

The default concurrency is set to 3 concurrent requests. This can be adjusted via:

```
MAX_CONCURRENCY=3
```

## Troubleshooting

Common issues and solutions:

1. **Redis Connection Failures**

- Verify Upstash credentials in environment variables
- Check network connectivity
- Verify Redis service status on Upstash dashboard

2. **Memory Overload**

- Check `/status` endpoint for memory usage
- Restart service if memory usage is consistently high
- Adjust memory limits in `railway.json`

3. **API Errors**

- Check application logs on Railway
- Verify route handling in `app.js`
- Test endpoints individually to isolate issues

4. **Deployment Failures**

- Verify `railway.json` configuration
- Check for syntax errors in configuration files
- Ensure Railway CLI is properly authenticated

## Conclusion

This system is designed with fault tolerance in mind. Even if Redis is temporarily unavailable, the system will continue to function using memory caching as a fallback. Regular monitoring and maintenance will ensure optimal performance.
