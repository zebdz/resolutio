# GitHub Actions Deployment Setup

The beta and master workflows use the shared deployment job. Configure its site-specific runtime and migration database connections and poller bearer before the first deployment. The release procedure includes the vote-write hold, restricted runtime grants, private archive transfer and explicit fleet release. [Deployment summary](DEPLOYMENT-SUMMARY.md) · [Poll seal cutover](Poll-Seal-Rollout.md)

## Troubleshooting

### Check Deployment Logs

On production server:

```bash
tail -100 /var/www/www-root/data/www/resolutio.site/deploy.log
```

### Check Next.js Logs

Look for the nohup output in deploy.log or check ISP panel logs.

### Rollback

Hold writes across the fleet before rolling back. Recover with a complete compatible artifact and preserve the live database and evidence. [Failure and rollback procedure](Poll-Seal-Rollout.md#failures-and-rollback)

### GitHub Action Failed?

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Click on the failed workflow run
4. Check which step failed and review logs

### Common Issues:

**SSH Connection Failed:**

- Verify `SSH_PRIVATE_KEY` secret is correctly set
- Ensure `SERVER_IP` in `deploy.yml` is correct
- Check if SSH key has access to the server

**Migration Failed:**

- Check the site-specific migration role and its connection
- Verify database is accessible from server
- Check migration logs in `deploy.log`

**Server Won't Start:**

- Port 3000 might be in use: `lsof -i :3000`
- Check for errors in `deploy.log`
- Verify environment variables are set correctly

## Testing the release

Use a disposable database and private artifact locally to exercise the migration, package and loopback scheduler. The rollout guide describes the same steps used for the release rehearsal. [Poll seal rollout](Poll-Seal-Rollout.md)
