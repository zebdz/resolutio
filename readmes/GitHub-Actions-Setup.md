# GitHub Actions Deployment Setup

## Prerequisites

### 1. Generate SSH Key (if you haven't already)

On your local machine:

```bash
# This key should already exist
cat ~/.ssh/id_ed25519_www_root_resolutio
```

### 2. Add Secrets to GitHub

Go to your repository on GitHub:

1. Navigate to: **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add these secrets:

#### Required Secrets:

| Secret Name       | Value                   | Where to get it                                         |
| ----------------- | ----------------------- | ------------------------------------------------------- |
| `SSH_PRIVATE_KEY` | Your SSH private key    | `cat ~/.ssh/id_ed25519_www_root_resolutio`              |
| `DATABASE_URL`    | Production database URL | Format: `postgresql://user:password@host:port/database` |

**Example DATABASE_URL:**

```
postgresql://reso:jWokEbO6*9@@127.0.0.1:11495/postgres
```

## How It Works

When you push to `master` branch:

1. ✅ GitHub Actions checks out your code
2. ✅ Installs dependencies
3. ✅ Runs `yarn build` (includes Prisma generation)
4. ✅ Creates `deploy.tar.gz` with:
   - `.next/` (built app)
   - `node_modules/` (all dependencies with Prisma engines)
   - `generated/` (Prisma client)
   - `prisma/` (schema and migrations)
   - `public/` (static files)
   - Config files and deployment scripts
5. ✅ Uploads to production server via SCP
6. ✅ On server, runs `deploy-on-server.sh` which:
   - Creates backup of current deployment
   - Extracts new files
   - Runs database migrations
   - Gracefully stops old Next.js server
   - Starts new Next.js server
   - Verifies it's running
7. ✅ Runs health check on https://resolutio.site

## Manual Deployment

If you need to deploy manually:

### From Local Machine:

```bash
# Build and create package
yarn build
tar -czf deploy.tar.gz .next/ node_modules/ generated/ prisma/ public/ package.json next.config.ts prisma.config.ts migrate-production.sh deploy-on-server.sh

# Upload to server
scp -i ~/.ssh/id_ed25519_www_root_resolutio deploy.tar.gz www-root@89.111.171.11:/var/www/www-root/data/www/resolutio.site/

# SSH to server and deploy
ssh -i ~/.ssh/id_ed25519_www_root_resolutio www-root@89.111.171.11
cd /var/www/www-root/data/www/resolutio.site
chmod +x deploy-on-server.sh
./deploy-on-server.sh
```

### On Production Server Only:

```bash
cd /var/www/www-root/data/www/resolutio.site

# Check if server is running
ps aux | grep next-server

# View logs
tail -f deploy.log

# Manually restart
pkill -f "next-server"
yarn start

# Check if it's listening
lsof -i :3000
```

## Troubleshooting

### Check Deployment Logs

On production server:

```bash
tail -100 /var/www/www-root/data/www/resolutio.site/deploy.log
```

### Check Next.js Logs

Look for the nohup output in deploy.log or check ISP panel logs.

### Rollback to Previous Version

```bash
cd /var/www/www-root/data/www/resolutio.site
ls -lt backup-*.tar.gz | head -1  # Find latest backup
tar -xzf backup-20251218-123456.tar.gz  # Replace with actual filename
pkill -f "next-server"
yarn start
```

### GitHub Action Failed?

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Click on the failed workflow run
4. Check which step failed and review logs

### Common Issues:

**SSH Connection Failed:**

- Verify `SSH_PRIVATE_KEY` secret is correctly set
- Ensure server IP (89.111.171.11) is correct
- Check if SSH key has access to the server

**Migration Failed:**

- Check `DATABASE_URL` secret is correct
- Verify database is accessible from server
- Check migration logs in `deploy.log`

**Server Won't Start:**

- Port 3000 might be in use: `lsof -i :3000`
- Check for errors in `deploy.log`
- Verify environment variables are set correctly

## Testing the Workflow

To test without pushing to master:

1. Create a test branch:

   ```bash
   git checkout -b test-deployment
   ```

2. Update `.github/workflows/deploy.yml` temporarily:

   ```yaml
   on:
     push:
       branches:
         - master
         - test-deployment # Add this
   ```

3. Push and watch the action run:

   ```bash
   git push origin test-deployment
   ```

4. After testing, remove the test branch from the workflow

## Security Notes

- ✅ SSH private key is stored as a GitHub secret (encrypted)
- ✅ Database URL is stored as a GitHub secret (encrypted)
- ✅ Secrets are never exposed in logs
- ✅ SSH key is deleted after deployment
- ⚠️ Make sure your SSH key doesn't have a passphrase (or use ssh-agent)
