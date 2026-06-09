#!/bin/bash
set -e

DEPLOY_DIR="${1:-./deploy}"

echo "=== deploy ==="
echo "Target: $DEPLOY_DIR"
echo ""

echo "[1/3] Compile..."
npx tsc --noEmit && npx tsc

echo "[2/3] Prepare $DEPLOY_DIR..."
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
cp -r dist "$DEPLOY_DIR/dist"
cp -r config "$DEPLOY_DIR/config"
cp package.json package-lock.json "$DEPLOY_DIR/"

echo "[3/3] Copy .env + install production deps..."
cp .env "$DEPLOY_DIR/.env"
cd "$DEPLOY_DIR"
npm ci --omit=dev --ignore-scripts
cd - > /dev/null

echo ""
echo "Done. Files ready in $DEPLOY_DIR/"
echo ""
echo "从部署目录启动:"
echo "  cd $DEPLOY_DIR && node dist/index.js"
echo ""
echo "从项目目录启动（无需部署）:"
echo "  ./start.sh prod"
