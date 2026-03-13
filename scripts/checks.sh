#!/usr/bin/env bash
set -euo pipefail

echo "Running lint..."
yarn lint

echo "Running typecheck..."
yarn typecheck

echo "Running tests..."
yarn test

echo "All checks passed."
