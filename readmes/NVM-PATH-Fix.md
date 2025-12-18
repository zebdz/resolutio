# Fix for NVM/Node PATH Issue

## Problem
When deploying via SSH, `node` and `yarn` commands were not found because they're installed via NVM, which doesn't load in non-interactive SSH sessions.

**Error messages:**
```
./migrate-production.sh: line 21: node: command not found
nohup: failed to run command 'yarn': No such file or directory
```

## Solution
Updated all production scripts to detect and use the full path to Node.js and Yarn binaries.

### Updated Files:

#### 1. `migrate-production.sh`
- Loads NVM if available
- Detects `node` binary location
- Falls back to hardcoded path: `/var/www/www-root/data/.nvm/versions/node/v24.12.0/bin/node`
- Uses full path to run Prisma migrations

#### 2. `deploy-on-server.sh`
- Loads NVM if available
- Detects both `node` and `yarn` binary locations
- Uses full paths for all commands
- Logs binary paths for debugging

#### 3. `start-production.sh`
- Loads NVM if available
- Detects `node` binary location
- Uses full path to start Next.js
- Logs startup information

#### 4. `package.json`
- Changed `start` script from direct node command to `./start-production.sh`
- This ensures node is always found via the wrapper script

#### 5. `.github/workflows/deploy.yml`
- Added `start-production.sh` to deployment package

## How It Works

### NVM Detection:
```bash
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi
```

### Binary Detection:
```bash
NODE_BIN=$(command -v node || echo "/var/www/www-root/data/.nvm/versions/node/v24.12.0/bin/node")
YARN_BIN=$(command -v yarn || echo "/var/www/www-root/data/.nvm/versions/node/v24.12.0/bin/yarn")
```

This approach:
1. First tries to find the binary in PATH (works if NVM loaded successfully)
2. Falls back to hardcoded full path (works even if NVM didn't load)

## Testing

### To test the scripts locally:
```bash
# Test start script
./start-production.sh

# Test migration script
./migrate-production.sh

# Test full deployment
./deploy-on-server.sh
```

### To deploy:
```bash
# Create package
tar -czf deploy.tar.gz .next/ node_modules/ generated/ prisma/ public/ package.json next.config.ts prisma.config.ts migrate-production.sh deploy-on-server.sh start-production.sh

# Upload to server
scp -i ~/.ssh/id_ed25519_www_root_resolutio deploy.tar.gz www-root@89.111.171.11:/var/www/www-root/data/www/resolutio.org/

# Deploy on server
ssh -i ~/.ssh/id_ed25519_www_root_resolutio www-root@89.111.171.11
cd /var/www/www-root/data/www/resolutio.org
./deploy-on-server.sh
```

Or just push to master and GitHub Actions will do it automatically!

## Verification

After deployment, check the logs:
```bash
tail -50 /var/www/www-root/data/www/resolutio.org/deploy.log
```

You should see:
```
[2025-12-18 19:42:00] Node binary: /var/www/www-root/data/.nvm/versions/node/v24.12.0/bin/node
[2025-12-18 19:42:00] Yarn binary: /var/www/www-root/data/.nvm/versions/node/v24.12.0/bin/yarn
[2025-12-18 19:42:05] ✅ Next.js server started successfully!
```

## Why This Happened

**Interactive vs Non-Interactive Shells:**
- When you SSH and get a shell: `.bashrc` is loaded → NVM is initialized → `node` is in PATH
- When GitHub Actions SSH runs a command: No `.bashrc` loaded → NVM not initialized → `node` not in PATH

**The Fix:**
- Explicitly load NVM in our scripts
- Fallback to hardcoded paths if NVM loading fails
- Use full paths for all Node.js/Yarn commands
