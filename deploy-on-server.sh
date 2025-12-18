#!/bin/bash

# Production server deployment script
# This script is run on the production server after files are uploaded

set -e  # Exit on any error

DEPLOY_DIR="/var/www/www-root/data/www/resolutio.org"
LOG_FILE="$DEPLOY_DIR/deploy.log"

# Load NVM if available
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Find node and yarn binaries
NODE_BIN=$(command -v node || echo "/var/www/www-root/data/.nvm/versions/node/v24.12.0/bin/node")
YARN_BIN=$(command -v yarn || echo "/var/www/www-root/data/.nvm/versions/node/v24.12.0/bin/yarn")

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========================================="
log "Starting deployment process..."
log "========================================="
log "Node binary: $NODE_BIN"
log "Yarn binary: $YARN_BIN"

# Navigate to deployment directory
cd "$DEPLOY_DIR"

# Backup current deployment
if [ -d ".next" ]; then
    BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    log "Creating backup: $BACKUP_FILE"
    tar -czf "$BACKUP_FILE" .next/ generated/ package.json 2>/dev/null || true
    
    # Keep only last 5 backups
    ls -t backup-*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
fi

# Extract new deployment
log "Extracting deployment package..."
tar -xzf deploy.tar.gz

# Run migrations
log "Running database migrations..."
./migrate-production.sh

# Find and kill existing next-server process
log "Stopping existing Next.js server..."
EXISTING_PID=$(pgrep -f "next-server" || true)
if [ -n "$EXISTING_PID" ]; then
    log "Found existing process: $EXISTING_PID"
    kill -TERM $EXISTING_PID 2>/dev/null || true
    
    # Wait for graceful shutdown (max 10 seconds)
    for i in {1..10}; do
        if ! ps -p $EXISTING_PID > /dev/null 2>&1; then
            log "Process stopped gracefully"
            break
        fi
        sleep 1
    done
    
    # Force kill if still running
    if ps -p $EXISTING_PID > /dev/null 2>&1; then
        log "Force killing process..."
        kill -9 $EXISTING_PID 2>/dev/null || true
    fi
else
    log "No existing process found"
fi

# Wait a moment for port to be released and for ISP panel to restart the app
log "Waiting for ISP panel to restart the application..."
sleep 5

# Check if ISP panel already restarted the server
NEW_PID=$(pgrep -f "next-server" || true)

if [ -n "$NEW_PID" ]; then
    log "✅ ISP panel automatically restarted the server (PID: $NEW_PID)"
    
    # Verify port 3000 is listening
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        log "✅ Server is listening on port 3000"
    else
        log "⚠️  Warning: Process is running but port 3000 is not listening yet"
        log "Waiting a bit more..."
        sleep 3
        if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
            log "✅ Server is now listening on port 3000"
        else
            log "⚠️  Server may still be starting up"
        fi
    fi
else
    # ISP panel didn't restart, start manually
    log "ISP panel did not restart automatically, starting manually..."
    cd "$DEPLOY_DIR"
    nohup "$YARN_BIN" start >> "$LOG_FILE" 2>&1 &
    NEW_PID=$!
    
    log "Started new process with PID: $NEW_PID"
    
    # Wait and verify the process started
    sleep 3
    if ps -p $NEW_PID > /dev/null 2>&1; then
        log "✅ Next.js server started successfully!"
        
        # Check if port 3000 is listening
        if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
            log "✅ Server is listening on port 3000"
        else
            log "⚠️  Warning: Server process is running but port 3000 is not listening yet"
        fi
    else
        log "❌ ERROR: Failed to start Next.js server"
        log "Check the logs at: $LOG_FILE"
        exit 1
    fi
fi

# Cleanup deployment package
rm -f deploy.tar.gz

log "========================================="
log "Deployment completed successfully!"
log "========================================="
