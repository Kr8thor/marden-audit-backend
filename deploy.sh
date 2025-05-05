#!/bin/bash
# Deploy script for Marden SEO Audit Backend to Railway

# NOTE: Before running this script, you must manually run:
# 1. railway login
# 2. railway init (if this is the first deployment)
# 3. railway link (if the project is already created)

echo "Deploying Marden SEO Audit Backend to Railway..."
echo "Using consolidated API endpoints with memory optimization..."

# Deploy to Railway
railway up
