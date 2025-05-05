# Marden SEO Audit Tool - Railway Deployment Checklist

## Pre-Deployment Checks

- [x] API consolidation in `api/index.js`
- [x] Memory management limits (256MB) in `app.js` 
- [x] Concurrency control implemented (max 3 concurrent requests)
- [x] Two-tier caching strategy (memory + Redis Upstash)
- [x] Error handling with consistent format
- [x] Health check endpoint properly configured
- [x] CORS settings correctly configured

## Railway Configuration

- [x] Dockerfile created
- [x] railway.json configured with correct settings
- [x] deploy.bat script created for Windows
- [x] Environment variables documented in .env.example
- [x] Package.json dependencies consolidated

## Testing

- [x] API starts successfully
- [x] Health check endpoint functions correctly

## Deployment Steps

1. **Local Setup**
   - Ensure all files are committed to GitHub repo
   - Verify all pre-deployment checks are complete

2. **Railway Setup**
   - Install Railway CLI: `npm install -g @railway/cli`
   - Run: `railway login` (requires manual browser authentication)
   - Run: `railway init` (first time only)
   - Run: `railway link` (if project already exists)
   - Set environment variables in Railway dashboard or via CLI

3. **Deployment**
   - Run: `deploy.bat` (or `railway up`)
   - Verify deployment success in Railway dashboard
   - Test all endpoints after deployment

4. **Monitoring**
   - Monitor memory usage via Railway dashboard
   - Check Redis connection status
   - Verify API performance and response times

## Environment Variables Required in Railway

- `PORT` (default: 3000)
- `NODE_ENV` (production)
- `UPSTASH_REDIS_REST_URL` (from Upstash dashboard)
- `UPSTASH_REDIS_REST_TOKEN` (from Upstash dashboard)
- `MAX_CONCURRENCY` (default: 3)
- `CORS_ORIGIN` (comma-separated list of allowed origins)

## Post-Deployment

- Monitor application logs for any errors
- Set up scheduled health checks
- Configure auto-restart on failure
- Set up alerts for high memory usage
