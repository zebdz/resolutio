#!/bin/bash

# Production startup script for Next.js
# This script starts the Next.js application without relying on symlinks

# Set the base directory
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASE_DIR"

# Set environment variables
export NODE_ENV=production
export PORT=${PORT:-3000}

# Log startup
echo "Starting Next.js application..."
echo "Directory: $BASE_DIR"
echo "Node version: $(node --version)"
echo "Port: $PORT"
echo "Environment: $NODE_ENV"

# Start Next.js directly using node (bypasses broken symlinks)
exec node "$BASE_DIR/node_modules/next/dist/bin/next" start
