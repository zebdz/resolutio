#!/usr/bin/env bash
# Package the built application, verifier and migration tools. Stage the chosen
# runtime configuration privately so a developer's local .env is preserved.
set -eu
umask 077
runtime_env=${1:-.env.production}
archive=${2:-deploy.tar.gz}
stage=$(mktemp -d)
trap 'rm -f "$stage/.env"; rmdir "$stage"' EXIT
install -m 600 "$runtime_env" "$stage/.env"
tar --exclude=.next/dev --exclude=.next/cache --exclude=.next/trace -czf "$archive" \
  .next node_modules generated prisma public messages \
  src/infrastructure/anchor/ots-worker.mjs src/i18n build/version-helper.ts \
  build/backfill-receipt-secrets.cjs build/verify-seal.mjs scripts/seal-ops \
  package.json next.config.ts prisma.config.ts migrate-production.sh \
  deploy-on-server.sh start-production.sh -C "$stage" .env
chmod 600 "$archive"
