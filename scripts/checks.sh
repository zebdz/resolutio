#!/usr/bin/env bash
set -euo pipefail

# Only format regular files. Formatting a symlink can overwrite its target.
STAGED_FILES=$(git diff --cached --name-only --diff-filter=d | while IFS= read -r path; do
  if [[ ! -L "$path" ]]; then
    printf '%s\n' "$path"
  fi
done)

if [ -n "$STAGED_FILES" ]; then
  LINT_FILES=$(echo "$STAGED_FILES" | grep -E '\.(js|jsx|ts|tsx|mjs|cjs)$' || true)
  FORMAT_FILES=$(echo "$STAGED_FILES" | grep -E '\.(js|jsx|ts|tsx|mjs|cjs|json|css|scss|md|yml|yaml|html)$' || true)

  if [ -n "$LINT_FILES" ]; then
    echo "Running lint on staged files..."
    echo "$LINT_FILES" | xargs npx eslint --fix
  fi

  if [ -n "$FORMAT_FILES" ]; then
    echo "Running format on staged files..."
    echo "$FORMAT_FILES" | xargs npx prettier --write
  fi

  echo "$STAGED_FILES" | xargs git add
fi

echo "Running typecheck..."
yarn typecheck

echo "Running tests..."
yarn test

echo "Running secret scan..."
ggshield secret scan pre-commit

echo "All checks passed."
