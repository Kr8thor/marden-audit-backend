@echo off
echo Deploying Marden Audit Backend changes to GitHub and Vercel...

echo Committing changes to local repository...
git add .
git commit -m "Add Redis caching and improve error handling"

echo Pushing changes to GitHub...
git push origin master

echo Deploying to Vercel...
call vercel --prod

echo Deployment complete!
pause
