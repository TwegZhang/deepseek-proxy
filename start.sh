#!/bin/bash
set -e

show_help() {
  cat <<EOF
deepseek-proxy — DeepSeek Anthropic API 代理

用法:
  ./start.sh                   开发模式（tsx watch，HTTP）
  ./start.sh run               单次启动
  ./start.sh prod              生产模式（HTTP）
  ./start.sh https             本地 HTTPS（mkcert/自签名）
  ./start.sh https DOMAIN      公网 HTTPS（Let's Encrypt 签发）
  ./start.sh --config FILE     指定配置文件
  ./start.sh help              帮助

部署:
  ./deploy.sh                  编译并准备部署目录
  ./deploy.sh /opt/proxy       指定部署目录

证书方式:
  ./start.sh https             本地测试（mkcert，不签发 CA）
  ./start.sh https x.y.com     公网生产（Let's Encrypt，所有人信任）
  DP_HTTPS_CERT + KEY_PATH     手动指定证书路径
EOF
}

gen_certs() {
  local CERT_DIR="${1:-./certs}"
  local DOMAIN="${2:-}"
  mkdir -p "$CERT_DIR"
  local CERT="$CERT_DIR/server.crt"
  local KEY="$CERT_DIR/server.key"

  if [ -f "$CERT" ] && [ -f "$KEY" ]; then
    return 0
  fi

  # Let's Encrypt for public domain
  if [ -n "$DOMAIN" ]; then
    echo "签发 Let's Encrypt 证书 ($DOMAIN)..."
    if ! command -v acme.sh &>/dev/null; then
      curl https://get.acme.sh | sh
      source ~/.zshrc 2>/dev/null || source ~/.bashrc 2>/dev/null || true
    fi
    ~/.acme.sh/acme.sh --issue --standalone -d "$DOMAIN" \
      --cert-file "$CERT" --key-file "$KEY"
    echo "证书已签发，acme.sh 将自动续期"
    export DP_HTTPS_CERT="$CERT"
    export DP_HTTPS_KEY="$KEY"
    return 0
  fi

  # Local dev: mkcert or self-signed
  LOCAL_IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
  [ -z "$LOCAL_IP" ] && LOCAL_IP="127.0.0.1"

  if command -v mkcert &>/dev/null; then
    echo "使用 mkcert ($LOCAL_IP)..."
    mkcert -cert-file "$CERT" -key-file "$KEY" localhost 127.0.0.1 "$LOCAL_IP" 2>&1
  else
    echo "自签名证书 ($LOCAL_IP)..."
    echo "提示: brew install mkcert && mkcert -install"
    openssl req -x509 -nodes -days 365 \
      -subj "/CN=$LOCAL_IP" \
      -addext "subjectAltName=IP:$LOCAL_IP,IP:127.0.0.1,DNS:localhost" \
      -newkey rsa:2048 \
      -keyout "$KEY" -out "$CERT" 2>/dev/null
  fi

  export DP_HTTPS_CERT="$CERT"
  export DP_HTTPS_KEY="$KEY"
}

# === Deploy environment (no src/, has dist/) ===
if [ ! -d "src" ] && [ -d "dist" ]; then
  case "${1:-}" in
    help|--help|-h) show_help; exit 0 ;;
    https) gen_certs certs "${2:-}"; echo "=== HTTPS ==="; node dist/index.js ;;
    *) echo "=== 生产模式 ==="; node dist/index.js ;;
  esac
  exit 0
fi

# === Dev environment ===
case "${1:-}" in
  help|--help|-h) show_help; exit 0 ;;
  run) echo "=== 单次启动 ==="; npx tsx src/index.ts ;;
  prod)
    [ ! -d "dist" ] && { echo "dist/ 不存在: npx tsc"; exit 1; }
    echo "=== 生产模式 ==="; node dist/index.js ;;
  https)
    [ ! -d "dist" ] && { echo "编译中..."; npx tsc; }
    gen_certs certs "${2:-}"
    echo "=== HTTPS ==="; node dist/index.js ;;
  --config)
    [ -z "$2" ] && { echo "用法: ./start.sh --config FILE"; exit 1; }
    export DP_CONFIG_PATH="$2"
    echo "配置: $2"; npx tsx src/index.ts ;;
  *)
    echo "=== 开发模式 (watch) ==="
    npx tsx watch src/index.ts ;;
esac
