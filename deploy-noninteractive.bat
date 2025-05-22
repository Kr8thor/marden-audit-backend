@echo off
echo Deploying Marden SEO Audit Backend to Railway (Non-interactive mode)...

echo Copying optimized files to production files...
copy /Y api\index.optimized.js api\index.js
copy /Y api\lib\redis.optimized.js api\lib\redis.js

echo Copying Railway environment...
copy /Y .env.railway .env

echo Checking for missing dependencies...
call npm list express cheerio axios cors || (
  echo Adding missing dependencies...
  call npm install express cheerio axios cors --save
)

echo Creating deployment instructions...
echo 1. Open a command prompt in this directory
echo 2. Run the following commands manually:
echo.
echo    railway login
echo    railway init
echo    - When prompted, select the "marden-seo-audit" project if it exists, or create a new one
echo    railway up
echo    railway deploy
echo    railway domain
echo.
echo 3. Note the domain URL for the backend - you'll need it for the frontend
echo.
echo The backend files are now prepared for deployment!
