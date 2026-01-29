# Use a slim Node.js (LTS) image as base
FROM node:22-slim

WORKDIR /app

# Install system dependencies and clean up in single layer
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    make \
    g++ \
    curl \
    wget \
    poppler-utils && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install PM2 process manager globally
RUN npm install pm2 -g

# Copy package files for dependency installation
COPY package*.json ./

# Copy Tailwind/PostCSS config and Tailwind input file needed for building CSS before full source copy
COPY tailwind.config.cjs postcss.config.cjs src/styles/tailwind-input.css ./src/styles/tailwind-input.css

# Build Tailwind CSS using npx (no package.json mutation required)
RUN npx tailwindcss -i src/styles/tailwind-input.css -o public/css/tailwind.css --minify || true && npm cache clean --force

# Copy application source code
COPY . .

# Install dependencies (include dev deps for bundling)
ARG NPM_OMIT_DEV=1
RUN npm install --no-audit --no-fund || \
    npm install --legacy-peer-deps --no-audit --no-fund || true

# Build Islands
RUN npm run build:islands

# Clean up dev dependencies if requested
RUN if [ "$NPM_OMIT_DEV" = "1" ]; then npm prune --production; fi
RUN npm cache clean --force

# Normalize line endings and make startup script executable
RUN sed -i 's/\r$//' /app/start-services.sh && chmod +x /app/start-services.sh

# Configure persistent data volume
VOLUME ["/app/data"]

# Configure application port - aber der tatsächliche Port wird durch PAPERLESS_AI_PORT bestimmt
EXPOSE ${PAPERLESS_AI_PORT:-3000}

# Add health check with dynamic port
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PAPERLESS_AI_PORT:-3000}/health || exit 1

# Set production environment
ENV NODE_ENV=production
ENV VISUAL_RAG_TIMEOUT=10000

# Start both Node.js and Python services using our script
CMD ["./start-services.sh"]
