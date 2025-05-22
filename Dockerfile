FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application files
COPY . .

# Set environment variables
ENV NODE_OPTIONS="--max-old-space-size=256"
ENV NODE_ENV="production"
ENV MAX_CONCURRENCY="3"
ENV MAX_MEMORY_PERCENT="80"
ENV CORS_ORIGIN="https://audit.mardenseo.com,http://localhost:9090"

# Expose the application port
EXPOSE 3000

# Enable health checks
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "app.js"]
