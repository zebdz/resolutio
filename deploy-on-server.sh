#!/bin/bash

# Production server deployment script
# This script is run on the production server after files are uploaded

set -eo pipefail
umask 077

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$DEPLOY_DIR/deploy.log"

# Load NVM if available
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Find the node binary
NODE_BIN=$(command -v node || echo "/var/www/www-root/data/.nvm/versions/node/v24.12.0/bin/node")

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========================================="
log "Starting deployment process..."
log "========================================="
log "Deploy dir: $DEPLOY_DIR"
log "Node binary: $NODE_BIN"

# Navigate to deployment directory
cd "$DEPLOY_DIR"

# Install only the cutover tools before touching files the old app can load.
archive=${1:?provide the private deployment archive path}
IFS= read -r migration_url
: "${migration_url:?migration connection required on stdin}"
tar -xzf "$archive" scripts/seal-ops
if [[ ! -d node_modules ]]; then
    tar -xzf "$archive" node_modules
fi
DATABASE_URL="$migration_url" node scripts/seal-ops/rollout.mjs prepare

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
tar -xzf "$archive"

PORT=$(sed -n 's/^PORT=//p' .env)
[[ "$PORT" =~ ^[0-9]+$ ]] || exit 1
# Run migrations
log "Running database migrations..."
DATABASE_URL="$migration_url" ./migrate-production.sh
unset migration_url
node scripts/seal-ops/rollout.mjs check-runtime

# Find and kill existing next-server process on this port
log "Stopping existing Next.js server on port $PORT..."
EXISTING_PID=$(lsof -Pi ":$PORT" -sTCP:LISTEN -t 2>/dev/null || true)

# Fallback: try fuser if lsof found nothing
if [ -z "$EXISTING_PID" ]; then
    EXISTING_PID=$(fuser "$PORT"/tcp 2>/dev/null | tr -d ' ' || true)
fi

if [ -n "$EXISTING_PID" ]; then
    log "Found existing process on port $PORT: $EXISTING_PID"
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
    log "No existing process found on port $PORT"
fi

# Wait a moment for port to be released and for ISP panel to restart the app
log "Waiting for ISP panel to restart the application..."
sleep 5

# Check if ISP panel already restarted the server
NEW_PID=$(lsof -Pi ":$PORT" -sTCP:LISTEN -t 2>/dev/null || true)
if [ -z "$NEW_PID" ]; then
    NEW_PID=$(fuser "$PORT"/tcp 2>/dev/null | tr -d ' ' || true)
fi

if [ -n "$NEW_PID" ]; then
    log "ISP panel restarted the server (PID: $NEW_PID)"
else
    log "Starting the loopback application..."
    nohup ./start-production.sh >> "$LOG_FILE" 2>&1 &
fi

# Test the app itself. A supervisor PID can exist before Next accepts requests.
for attempt in {1..15}; do
    status=$(curl --silent --max-time 2 -o /dev/null -w '%{http_code}' \
        -H 'X-Forwarded-Proto: https' "http://127.0.0.1:$PORT/ru/login" || true)
    if [[ "$status" == 200 ]]; then
        log "Application healthy on port $PORT. Deployment complete."
        exit 0
    fi
    sleep 1
done
log "Application failed its loopback health check"
exit 1
