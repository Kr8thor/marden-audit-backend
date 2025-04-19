#!/bin/bash
# Deploy script for backend

# Ensure we're using the consolidated API endpoints
echo "Deploying backend with consolidated API endpoints..."
vercel --prod
