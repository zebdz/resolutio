#!/bin/bash

# Production startup script for Next.js
# This script starts the Next.js application without relying on symlinks

# Load NVM if available
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Find node binary
NODE_BIN=$(command -v node || echo "/var/www/www-root/data/.nvm/versions/node/v24.12.0/bin/node")

# Set the base directory
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASE_DIR"

# Set environment variables
export NODE_ENV=production
export PORT=${PORT:-3000}

# Log startup
echo "Starting Next.js application..."
echo "Directory: $BASE_DIR"
echo "Node binary: $NODE_BIN"
echo "Node version: $($NODE_BIN --version)"
echo "Port: $PORT"
echo "Environment: $NODE_ENV"

# Start Next.js directly using node (bypasses broken symlinks)
exec "$NODE_BIN" "$BASE_DIR/node_modules/next/dist/bin/next" start
