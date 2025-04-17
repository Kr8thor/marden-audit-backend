#!/bin/bash

# Move original API directory to backup if it doesn't exist already
if [ ! -d "api_old" ]; then
  mv api api_old
fi

# Make sure api_new is moved to api to reduce function count
if [ -d "api_new" ]; then
  rm -rf api
  mv api_new api
  echo "Successfully moved api_new to api for deployment."
fi

# Deploy to Vercel
vercel deploy --prod

echo "Deployment complete!"
