#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

echo "==> Checking Node.js"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but was not found. Install Node 18+ and re-run this script." >&2
  exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node 18+ is required (found $(node --version))." >&2
  exit 1
fi
echo "    node $(node --version)"

echo "==> Checking pnpm"
if ! command -v pnpm >/dev/null 2>&1; then
  echo "    pnpm not found, attempting to install it"
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm@9.12.0 --activate
  elif command -v npm >/dev/null 2>&1; then
    npm install -g pnpm
  else
    echo "Could not find corepack or npm to install pnpm. Install pnpm manually: https://pnpm.io/installation" >&2
    exit 1
  fi
fi
echo "    pnpm $(pnpm --version)"

echo "==> Installing dependencies"
pnpm install

echo "==> Type-checking"
pnpm typecheck

echo "==> Running tests"
pnpm test

echo ""
echo "Setup complete. Try: pnpm test  (or) pnpm --filter @bulletspace/core test -- --watch"
