#!/bin/bash

# Restart the Next.js server for THIS deployment.
#
# Manual deploy: copy this file to the server — either into the deploy root
# next to .env, or into a scripts/ subfolder of it (both work). Run ./restart.sh
# AS THE PROCESS OWNER (www-root); it is safe to log out afterwards.
#
# - PORT comes from the deploy dir's .env, so the copy under resolutio.site
#   restarts prod (3000) and the copy under beta.resolutio.site restarts
#   beta (3001). It only ever touches the process on ITS OWN port, so it can
#   never kill the other server.
# - Stops the server; if the ISP-panel supervisor respawns it, that fresh
#   process picks up the new .env. If nothing respawns it, we start it
#   ourselves — detached (setsid + nohup) so it survives logout.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# App dir = the directory that holds .env. This script may sit in the deploy
# root or in a scripts/ subfolder of it.
if [ -f "$SCRIPT_DIR/.env" ]; then
    APP_DIR="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/../.env" ]; then
    APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
else
    APP_DIR="$SCRIPT_DIR"
fi
cd "$APP_DIR"

LOG_FILE="$APP_DIR/restart.log"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

# PORT from the deploy dir's .env (fallback 3000)
[ -f "$APP_DIR/.env" ] && PORT=$(grep -E '^PORT=' "$APP_DIR/.env" | cut -d= -f2)
PORT=${PORT:-3000}

# Resolve yarn the same way deploy-on-server.sh does
if [ -f "$HOME/.nvm/nvm.sh" ]; then export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; fi
YARN_BIN=$(command -v yarn || echo "/var/www/www-root/data/.nvm/versions/node/v24.12.0/bin/yarn")

# PID(s) listening on our port. Prefer `ss`: on this host `lsof` is blind to the
# socket even for its owner. Fall back to lsof/fuser where `ss -p` is unprivileged.
port_pid() {
    local pids
    pids=$(ss -ltnp "sport = :$PORT" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
    [ -z "$pids" ] && pids=$(lsof -Pi ":$PORT" -sTCP:LISTEN -t 2>/dev/null)
    [ -z "$pids" ] && pids=$(fuser "$PORT/tcp" 2>/dev/null | tr -d ' ')
    echo $pids
}

# True if ANYTHING is listening on our port, even when we can't name the PID.
# Guards the manual start below from spawning a duplicate (EADDRINUSE).
port_in_use() { ss -ltn "sport = :$PORT" 2>/dev/null | grep -q LISTEN; }

log "Restarting server in $APP_DIR (port $PORT)"

# --- Stop the process on our port ---
if port_in_use; then
    PID=$(port_pid)
    log "Stopping PID(s): ${PID:-unknown}"
    [ -n "$PID" ] && kill -TERM $PID 2>/dev/null || true
    for i in $(seq 1 10); do port_in_use || break; sleep 1; done
    if port_in_use; then
        log "Forcing kill"
        PID=$(port_pid); [ -n "$PID" ] && kill -9 $PID 2>/dev/null || true
        sleep 2
    fi
else
    log "Nothing listening on port $PORT"
fi

# --- Did the supervisor (ISP panel) bring it back on its own? ---
for i in $(seq 1 10); do
    if port_in_use; then
        log "Supervisor auto-restarted it (PID $(port_pid)) — fresh .env applied"; exit 0
    fi
    sleep 1
done

# --- Nothing respawned it -> start it ourselves, detached (survives logout) ---
log "No auto-restart detected — starting manually (detached)"
if [ -x "$APP_DIR/start-production.sh" ]; then
    setsid nohup "$APP_DIR/start-production.sh" >> "$LOG_FILE" 2>&1 < /dev/null &
else
    setsid nohup "$YARN_BIN" start >> "$LOG_FILE" 2>&1 < /dev/null &
fi

for i in $(seq 1 10); do
    if port_in_use; then log "Started (PID $(port_pid)) on port $PORT"; exit 0; fi
    sleep 1
done
log "ERROR: server did not come up on port $PORT — see $LOG_FILE"; exit 1
