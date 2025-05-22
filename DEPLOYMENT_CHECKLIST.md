# Deployment Checklist for Marden SEO Audit Backend

This checklist helps ensure that all necessary steps are completed before and during deployment.

## Pre-Deployment Checks

1. [ ] Verify all API endpoints are working locally
   - `/health` - Health check endpoint
   - `/seo-analyze` - Full SEO analysis
   - `/basic-audit` - Alias for SEO analysis
   - `/site-audit` - Site-wide SEO analysis
   - `/` - API information endpoint
2. [ ] Check that Redis integration is properly configured
   - Upstash credentials are set in Railway environment variables
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are valid
3. [ ] Ensure CORS settings match production requirements
   - `CORS_ORIGIN` includes `https://audit.mardenseo.com`, Railway deployments, and development URLs
4. [ ] Validate memory limits are properly set
   - `--max-old-space-size=256` is configured in both `NODE_OPTIONS` and startup command
5. [ ] All files reference the correct entry point (`api/index.js`)
   - Dockerfile uses correct entry point
   - Railway configuration uses the correct entry point

## Deployment Process

1. [ ] Update environment variables in Railway dashboard
   - Set all required environment variables, especially Redis credentials
   - Set `NODE_ENV=production`
2. [ ] Use Railway CLI to deploy: `railway up`
   - Ensure you're logged in: `railway login`
   - Ensure project is linked: `railway link`
3. [ ] Verify deployment succeeded
   - Check Railway dashboard for successful build and deployment
   - Check logs for any errors

## Post-Deployment Verification

1. [ ] Verify health endpoint returns OK status
   - `curl https://marden-audit-backend-production.up.railway.app/health`
   - Check that Redis is connected successfully
2. [ ] Test cache functionality is working
   - Make repeated requests to the same URL and verify `cached: true` in responses
3. [ ] Verify SEO analysis endpoints work with real URLs
   - Test `/seo-analyze` with a real URL
   - Test `/basic-audit` with a real URL
   - Test `/site-audit` with a real URL
4. [ ] Check frontend integration succeeds
   - Verify frontend can connect to the backend API
   - Verify analysis results are displayed correctly
5. [ ] Monitor performance metrics
   - Check memory usage is below limits
   - Verify concurrency control is working properly
   - Check Redis cache hit rate

## Redis Troubleshooting

If Redis is not connecting:
1. [ ] Double-check Upstash credentials in Railway dashboard
2. [ ] Verify Upstash service is running
3. [ ] Check Redis connection logs in application

## Frontend Integration Checks

1. [ ] Verify frontend environment variables:
   - `VITE_API_URL` points to the correct backend URL
   - `VITE_API_FALLBACK_URL` is set for local development
2. [ ] Check that frontend can handle API failures gracefully
3. [ ] Verify loading indicators work correctly
4. [ ] Test error messages are user-friendly