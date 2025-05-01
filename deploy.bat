@echo off
echo Deploying Marden Audit Backend to GitHub and Vercel...

echo Committing changes to GitHub...
git add .
git commit -m "Implement v2 API with Redis integration and job processing"
git push origin main

echo Installing dependencies...
call npm install

echo Installing vercel CLI if not already installed...
call npm install -g vercel

echo Deploying to production...
call vercel --prod

echo Deployment completed!
pause