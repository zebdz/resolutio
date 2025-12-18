#!/bin/bash

# Deployment package creation script
# This creates a minimal deployment package and installs dependencies on production

echo "Creating deployment package..."

# Create package with built files only (no node_modules)
tar -czf deploy.tar.gz \
  .next/ \
  generated/ \
  prisma/ \
  public/ \
  src/ \
  messages/ \
  package.json \
  yarn.lock \
  next.config.ts \
  prisma.config.ts \
  migrate-production.sh \
  tsconfig.json \
  eslint.config.mjs \
  postcss.config.mjs \
  next-env.d.ts

echo "✅ Deployment package created: deploy.tar.gz"
echo ""
echo "📦 On production server, run:"
echo "  1. tar -xzf deploy.tar.gz"
echo "  2. yarn install --production=false"
echo "  3. ./migrate-production.sh"
echo "  4. yarn start (or restart via ISP panel)"
