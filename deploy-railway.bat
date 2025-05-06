@echo off
echo Deploying to Railway with site audit endpoint...

:: Get the current Git branch
for /f "tokens=*" %%a in ('git rev-parse --abbrev-ref HEAD') do set CURRENT_BRANCH=%%a
echo Current branch: %CURRENT_BRANCH%

:: Commit changes if needed
git add .
git commit -m "Add site-audit endpoint for crawler functionality"

:: Deploy to Railway
railway up

echo Deployment complete! Site audit endpoint should now be available.
echo You can test it by using the debug panel in the frontend.
pause
