# ISP Panel Auto-Restart Behavior

## What Happens

Your ISP panel (reg.ru) has automatic process management that:
1. Monitors your Node.js application
2. Automatically restarts it when it stops or crashes
3. Keeps it running 24/7

## During Deployment

### Expected Behavior:
```
1. Deploy script kills old Next.js process
2. ISP panel detects the process stopped
3. ISP panel automatically restarts it within ~5 seconds
4. New code is loaded and running
```

### What You'll See in Logs:
```
[2025-12-18 19:48:30] Found existing process: 403141
[2025-12-18 19:48:31] Process stopped gracefully
[2025-12-18 19:48:33] Starting Next.js server...
[2025-12-18 19:48:36] ❌ ERROR: Failed to start Next.js server
```

**This is NORMAL!** The "error" occurs because:
- Deploy script tries to start the server manually
- But ISP panel already auto-restarted it
- Port 3000 is already in use by the ISP-managed process
- The deployment actually succeeded! ✅

## How to Verify Deployment Success

### 1. Check the site loads:
```bash
curl -I https://resolutio.org
```

### 2. Check process is running:
```bash
ps aux | grep next-server
```

### 3. Check port 3000:
```bash
lsof -i :3000
```

### 4. Check recent changes:
Visit the site and verify your changes are live.

## Updated Deploy Script

The `deploy-on-server.sh` script now handles this intelligently:

1. Stops the old process
2. Waits 5 seconds for ISP panel to restart
3. Checks if process is running
   - **If yes**: ISP panel restarted it ✅ (deployment successful)
   - **If no**: Starts it manually

## Why This Is Good

✅ **Zero-downtime deployments**: ISP panel restarts your app immediately
✅ **Automatic recovery**: If your app crashes, it auto-restarts
✅ **Reliable**: No manual intervention needed

## Troubleshooting

### If site doesn't load after deployment:

1. **Check ISP panel logs:**
   Look in your ISP control panel for application logs

2. **Check deploy.log:**
   ```bash
   tail -100 /var/www/www-root/data/www/resolutio.org/deploy.log
   ```

3. **Manually restart via ISP panel:**
   Use the ISP panel interface to restart the Node.js application

4. **Check environment variables:**
   Ensure `DATABASE_URL` and other vars are set in ISP panel

### If you see "EADDRINUSE" error:

This is **expected and normal**! It means:
- ISP panel already restarted the app
- The deployment succeeded
- Just check that the site loads

## Manual Restart (if needed)

If you ever need to manually restart without deploying:

```bash
# Via ISP panel
Use the restart button in the Node.js application section

# Via SSH (if ISP panel restart fails)
pkill -f "next-server"
# Wait 5 seconds for ISP to auto-restart
# Or start manually:
cd /var/www/www-root/data/www/resolutio.org
yarn start
```

## GitHub Actions Considerations

The GitHub Actions workflow now:
- Waits 10 seconds after deployment
- Retries health check 3 times
- Accounts for ISP auto-restart delay
- Won't fail if there's a brief startup period

This means deployments should consistently succeed even with the auto-restart behavior.
