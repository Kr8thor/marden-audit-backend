@echo off
REM Deploy script for Marden SEO Audit Backend to Railway

echo NOTE: Before running this script, you must manually run:
echo 1. railway login
echo 2. railway init (if this is the first deployment)
echo 3. railway link (if the project is already created)

echo Deploying Marden SEO Audit Backend to Railway...
echo Using consolidated API endpoints with memory optimization...

REM Deploy to Railway
railway up
