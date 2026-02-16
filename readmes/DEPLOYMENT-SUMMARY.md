# Deployment Summary

## What We've Set Up

### 1. **Automated GitHub Actions Deployment** ✅

- File: `.github/workflows/deploy.yml`
- Triggers on every push to `master` branch
- Automatically builds, packages, deploys, and restarts your app

### 2. **Production Scripts** ✅

#### `migrate-production.sh`

- Runs Prisma migrations on production
- Uses local Prisma engines (no download needed)
- Usage: `./migrate-production.sh`

#### `deploy-on-server.sh`

- Complete deployment automation on server
- Creates backups before deploying
- Gracefully restarts Next.js server
- Logs everything to `deploy.log`
- Usage: `./deploy-on-server.sh`

#### `create-deploy-package.sh`

- Alternative manual deployment helper
- Creates minimal package without node_modules
- For when you want to run `yarn install` on server

### 3. **Updated Configurations** ✅

#### `package.json`

```json
"start": "PORT=3000 NODE_ENV=production node node_modules/next/dist/bin/next start"
```

- Direct Node.js invocation (bypasses broken symlinks)
- ISP panel compatible

#### `prisma/schema.prisma`

```prisma
generator client {
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}
```

- Pre-downloads correct Prisma engines for production
- No network downloads needed on server

#### `nginx-production.conf`

- Properly serves `/_next/static/` files
- Handles both HTTP and HTTPS
- Proxies to Node.js on port 3000

## Next Steps

### 1. Add GitHub Secrets

Go to: https://github.com/zebdz/resolutio/settings/secrets/actions

Add these two secrets:

- `SSH_PRIVATE_KEY` - Your SSH private key
- `DATABASE_URL` - Production database connection string

### 2. Update Nginx Configuration

Upload `nginx-production.conf` to your server and configure it in the ISP panel.

### 3. Test the Workflow

Option A: Push to master

```bash
git add .
git commit -m "Setup automated deployment"
git push origin master
```

Option B: Test manually first

```bash
# SERVER_IP is defined in .github/workflows/deploy.yml
export SERVER_IP=89.111.155.217

yarn build
tar -czf deploy.tar.gz .next/ node_modules/ generated/ prisma/ public/ package.json next.config.ts prisma.config.ts migrate-production.sh deploy-on-server.sh
scp -i ~/.ssh/id_ed25519_www_root_resolutio deploy.tar.gz www-root@$SERVER_IP:/var/www/www-root/data/www/resolutio.site/
ssh -i ~/.ssh/id_ed25519_www_root_resolutio www-root@$SERVER_IP
cd /var/www/www-root/data/www/resolutio.site
./deploy-on-server.sh
```

## How Deployment Works

```
┌─────────────────────┐
│  Push to master     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  GitHub Actions     │
│  - Install deps     │
│  - Build app        │
│  - Create tar       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  SCP to server      │
│  (see SERVER_IP     │
│   in deploy.yml)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  deploy-on-server   │
│  - Backup           │
│  - Extract          │
│  - Migrate DB       │
│  - Restart server   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Health Check       │
│  https://           │
│  resolutio.site      │
└─────────────────────┘
```

## Understanding the Process Stack

### What runs what:

```
ISP Panel → sh → node → next-server
                  ↑
                  └── This is Node.js runtime
                      (shows as "next-server" in ps)
```

### Port 3000:

- Next.js listens on port 3000
- Nginx proxies requests to it
- Only localhost access (not exposed directly)

### Files on Production Server:

```
/var/www/www-root/data/www/resolutio.site/
├── .next/              # Built Next.js app
├── node_modules/       # Dependencies + Prisma engines
├── generated/          # Generated Prisma client
├── prisma/             # Schema & migrations
├── public/             # Static files
├── package.json        # Dependencies manifest
├── next.config.ts      # Next.js config
├── prisma.config.ts    # Prisma config
├── migrate-production.sh
├── deploy-on-server.sh
├── deploy.log          # Deployment logs
└── backup-*.tar.gz     # Automatic backups
```

## Troubleshooting Quick Reference

### Check if server is running:

```bash
ps aux | grep next-server
lsof -i :3000
```

### View logs:

```bash
tail -f /var/www/www-root/data/www/resolutio.site/deploy.log
```

### Restart server manually:

```bash
cd /var/www/www-root/data/www/resolutio.site
pkill -f "next-server"
yarn start
```

### Check GitHub Actions:

https://github.com/zebdz/resolutio/actions

### Rollback:

```bash
cd /var/www/www-root/data/www/resolutio.site
tar -xzf backup-YYYYMMDD-HHMMSS.tar.gz
pkill -f "next-server"
yarn start
```

## Documentation Files

All documentation is in `readmes/`:

- `Deployment.md` - Detailed deployment guide
- `GitHub-Actions-Setup.md` - GitHub Actions setup guide
- `Migrations.md` - Database migrations guide
- `Testing.md` - Testing guide

## Success Indicators

✅ GitHub Action completes without errors
✅ https://resolutio.site loads successfully
✅ `ps aux | grep next-server` shows running process
✅ `lsof -i :3000` shows Next.js listening
✅ No errors in `deploy.log`

## Common Issues Solved

| Issue                             | Solution                                         |
| --------------------------------- | ------------------------------------------------ |
| Cannot find module 'require-hook' | Use direct node invocation in start script       |
| Prisma engine download fails      | Pre-generate with binaryTargets in schema.prisma |
| Failed to load chunk .js          | Add `/_next/static/` location in nginx           |
| Socket connection refused         | Use TCP port 3000 instead of Unix socket         |
| Migrations fail on production     | Use migrate-production.sh with local engines     |

---

Everything is now ready for automated deployments! 🚀
