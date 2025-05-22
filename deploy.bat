@echo off
REM Comprehensive Railway deployment script for Marden SEO Audit Backend

echo Deploying Marden SEO Audit Backend to Railway...
echo ================================================

REM Check if Railway CLI is installed
where railway >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Railway CLI not found. Please install it with: npm install -g @railway/cli
    exit /b 1
)

REM Check Railway login status
railway whoami >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo You are not logged in to Railway. Please run:
    echo railway login
    exit /b 1
)

REM Check if project is linked
railway environment >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo No Railway project linked. Please run one of these commands:
    echo railway link   (to link to an existing project)
    echo railway init   (to create a new project)
    exit /b 1
)

REM Ensure we're on the right branch
git checkout master

REM Check for uncommitted changes
git status --porcelain
if %ERRORLEVEL% equ 0 (
  echo Uncommitted changes detected. Committing...
  git add .
  git commit -m "Automated deployment commit"
)

REM Push to GitHub
echo Pushing changes to GitHub...
git push origin master

REM Deploy to Railway
echo Deploying to Railway...
railway up

echo Backend deployment complete!
for /f "tokens=*" %%a in ('railway domain') do set DOMAIN=%%a
echo Backend URL: %DOMAIN%

REM Show environment status
echo Environment status:
railway status