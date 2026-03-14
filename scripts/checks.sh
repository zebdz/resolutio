#!/usr/bin/env bash
set -euo pipefail

# Capture the list of staged files (excluding deleted ones via --diff-filter=d) before formatting, then only re-stage those specific files after yarn fl.
STAGED_FILES=$(git diff --cached --name-only --diff-filter=d)

echo "Running format + lint..."
yarn fl

if [ -n "$STAGED_FILES" ]; then
  echo "$STAGED_FILES" | xargs git add
fi

echo "Running typecheck..."
yarn typecheck

echo "Running tests..."
yarn test

echo "All checks passed."
