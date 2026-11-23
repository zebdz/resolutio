#!/usr/bin/env bash
# Run as the migration role. The shared database holds all ballot and finish
# writes across process failures until an operator releases the upgraded fleet.
set -eo pipefail
cd "$(dirname "$0")"
: "${DATABASE_URL:?provide the migration role connection for this process}"
node scripts/seal-ops/rollout.mjs prepare
node node_modules/prisma/build/index.js migrate deploy
node build/backfill-receipt-secrets.cjs
node scripts/seal-ops/rollout.mjs coverage
