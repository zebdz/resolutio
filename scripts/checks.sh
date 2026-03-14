#!/usr/bin/env bash
set -euo pipefail

echo "Running format + lint..."
yarn fl
git add -u

echo "Running typecheck..."
yarn typecheck

echo "Running tests..."
yarn test

echo "All checks passed."
