# ============================================================
# API Gateway — Node.js
# ============================================================
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm install dotenv

# Copy application source
COPY src/ ./src/

# Expose the gateway port
EXPOSE 3000

# Start the gateway
CMD ["node", "src/server.js"]
