#!/bin/bash
set -e

DEPLOY_DIR="${1:-./deploy}"

echo "=== deepseek-proxy deploy ==="
echo "Target: $DEPLOY_DIR"
echo ""

echo "[1/3] TypeScript compile..."
npx tsc --noEmit && npx tsc

echo "[2/3] Prepare $DEPLOY_DIR..."
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
cp -r dist "$DEPLOY_DIR/dist"
cp -r config "$DEPLOY_DIR/config"
cp package.json package-lock.json "$DEPLOY_DIR/"

echo "[3/3] Install production deps..."
cd "$DEPLOY_DIR"
npm ci --omit=dev --ignore-scripts
cd - > /dev/null

echo ""
echo "Done. Deployed to $DEPLOY_DIR/"
echo ""
echo "Run:"
echo "  cp .env $DEPLOY_DIR/.env"
echo "  cd $DEPLOY_DIR && node dist/index.js"
