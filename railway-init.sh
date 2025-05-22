#!/bin/bash
# Script to initialize the backend project in Railway

echo "Initializing Marden SEO Audit Backend in Railway..."
echo "=================================================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Railway CLI not found. Please install it with: npm install -g @railway/cli"
    exit 1
fi

# Check Railway login status
RAILWAY_LOGIN_STATUS=$(railway whoami 2>&1 || echo "Not logged in")
if [[ "$RAILWAY_LOGIN_STATUS" == *"Not logged in"* ]]; then
    echo "You are not logged in to Railway. Please run:"
    echo "railway login"
    exit 1
fi

# Create a new project in Railway
echo "Creating new Railway project: marden-seo-audit-backend..."
railway project create --name marden-seo-audit-backend

# Link to the newly created project
echo "Linking to the project..."
railway link

# Set environment variables
echo "Setting environment variables..."
railway variables set \
  NODE_ENV=production \
  PORT=3000 \
  MAX_CONCURRENCY=3 \
  MAX_MEMORY_PERCENT=80 \
  CORS_ORIGIN=https://audit.mardenseo.com,http://localhost:9090 \
  UPSTASH_REDIS_REST_URL=https://smiling-shrimp-21387.upstash.io \
  UPSTASH_REDIS_REST_TOKEN=AVOLAAIjcDFmNzVjNDVjZGM3MGY0NDczODEyMTA0NTAyOGNkMTc5OXAxMA

echo "Backend project initialization complete!"
echo "You can now run ./deploy.sh to deploy the backend"