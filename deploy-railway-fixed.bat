@echo off
echo Deploying Marden SEO Audit Backend to Railway (Fixed Version)...

REM Stop any current instances
echo Stopping current deployment...
railway down

REM Copy optimized files to production files
echo Copying optimized files to production...
copy /Y api\index.optimized-fixed.js api\index.js
copy /Y api\lib\redis.optimized.js api\lib\redis.js

REM Copy Railway environment variables
echo Copying Railway environment...
copy /Y .env.railway .env

echo Applying memory optimizations...
echo web: node --max-old-space-size=256 app.js > Procfile

echo Updating package.json...
node -e "const pkg = require('./package.json'); pkg.version = '2.1.1'; pkg.description = 'Marden SEO Audit Backend - Railway Optimized (Fixed)'; require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));"

echo Building and deploying...
railway up
railway deploy

echo Done! Your optimized backend should now be deployed with FULL functionality.
echo To verify deployment, visit the /health endpoint
