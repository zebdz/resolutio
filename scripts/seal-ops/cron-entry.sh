#!/usr/bin/env bash
# Emit one site-specific /etc/cron.d entry. The scheduler sees only local paths.
# Run from the installed release as the site's service account.
set -eu
site_dir=$(pwd -P)
node_path=$(command -v node)
account=$(id -un)
for value in "$site_dir" "$node_path" "$account"; do
  [[ "$value" =~ ^[a-zA-Z0-9_./-]+$ ]] || { echo 'Unsupported cron path or account' >&2; exit 1; }
done
[[ -f scripts/seal-ops/worker.mjs ]] || { echo 'Run in the deployed site directory' >&2; exit 1; }
printf '*/15 * * * * %s cd %s && umask 077 && /usr/bin/flock -n .seal-worker.lock %s scripts/seal-ops/worker.mjs >> seal-worker.log 2>&1\n' "$account" "$site_dir" "$node_path"
