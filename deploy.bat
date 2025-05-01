@echo off
echo Deploying Marden Audit Backend to Vercel...

echo Installing vercel CLI if not already installed...
call npm install -g vercel

echo Deploying to production...
call vercel --prod

echo Deployment completed!
pause