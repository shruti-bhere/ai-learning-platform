# Multi-stage build for Node.js application
FROM node:18-alpine AS builder

WORKDIR /app

# Improve npm network resilience during installs
RUN npm config set fetch-timeout 300000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

# Copy package files (root + server)
COPY package*.json ./
COPY server/package*.json ./server/

# Install root dependencies
RUN npm install

# Install server dependencies
WORKDIR /app/server
RUN npm install

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install system dependencies and language runtimes
RUN apk add --no-cache \
    openjdk17-jdk \
    python3 \
    py3-pip \
    go \
    bash \
    && rm -rf /var/cache/apk/*

# Set Java environment variables
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk
ENV PATH="$JAVA_HOME/bin:${PATH}"

# Verify installations
RUN java -version && \
    javac -version && \
    python3 --version && \
    go version && \
    node --version

# Copy server files
COPY --from=builder /app/server ./server
COPY --from=builder /app/package*.json ./

# Create temp directory for code execution
RUN mkdir -p /app/server/temp && \
    chmod 777 /app/server/temp

# Install production dependencies
WORKDIR /app/server
RUN npm install --production

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "index.js"]

