FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application files
COPY . .

# Set memory limit for Node
ENV NODE_OPTIONS="--max-old-space-size=256"

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "app.js"]
