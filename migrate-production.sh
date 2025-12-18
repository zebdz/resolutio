#!/bin/bash

# Production migration script
# This script sets the required environment variables and runs Prisma migrations
# without attempting to download engine binaries

# Set the base directory (adjust if needed)
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

# Set Prisma engine paths to use local binaries
export PRISMA_QUERY_ENGINE_BINARY="$BASE_DIR/node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node"
export PRISMA_SCHEMA_ENGINE_BINARY="$BASE_DIR/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x"

# Prevent Prisma from trying to download engines
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

echo "Running Prisma migrations..."
echo "Schema engine: $PRISMA_SCHEMA_ENGINE_BINARY"

# Run migrations using node directly to avoid symlink issues
node "$BASE_DIR/node_modules/prisma/build/index.js" migrate deploy

echo "Migrations complete!"
