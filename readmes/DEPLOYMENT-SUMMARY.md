# Deployment

Pushes to beta and master invoke the reusable deployment workflow for the corresponding site. The workflow builds Next.js, the standalone verifier and the receipt backfill, then uploads a private release archive over SSH. The server runs migrations with the migration credential, checks the restricted application credential and restarts the loopback Next.js service. The first poll-seal deployment leaves voting on hold for the fleet cutover. [Poll seal rollout and rollback](Poll-Seal-Rollout.md)

The workflow reads site-specific database and poller secrets. Beta uses the `_BETA` variants. Runtime configuration stays in the private deployed `.env`. For manual packaging from a built checkout, run:

```sh
yarn build
yarn build:receipt-backfill
yarn build:seal-verifier
./create-deploy-package.sh /private/path/runtime.env /private/path/deploy.tar.gz
```

Use the site service account and a private directory for the archive. Supply the migration connection only to the migration subprocess via the deployment script's stdin. Keep the live database backed up independently. The automatic code archive contains `.next`, `generated` and `package.json`. It cannot restore ballots, uploads, environment secrets or a complete previous release.

nginx reads `.next/static` and `public` directly. The workflow checks the public login page and its CSS and JavaScript after restart. Run the same check with `python3 scripts/check-deployed-assets.py https://resolutio.site`.

The tracked nginx configurations live in `nginx-conf/isp-nginx-production.conf` and `nginx-conf/isp-nginx-beta.conf`. Each site requires its own cron installation. [Scheduler, grants, audit settings and health checks](Poll-Seal-Rollout.md)
