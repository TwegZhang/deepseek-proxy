#!/bin/bash
set -e

show_help() {
  cat <<EOF
deepseek-proxy — 轻量级 DeepSeek Anthropic API 代理

用法:
  ./start.sh                   开发模式（tsx watch，HTTP）
  ./start.sh run               单次启动（不 watch）
  ./start.sh prod              生产模式（编译后启动，HTTP）
  ./start.sh https             生产模式 + HTTPS（mkcert 或自签名）
  ./start.sh --config FILE     指定配置文件
  ./start.sh help              显示帮助

部署:
  ./deploy.sh                  编译并准备部署目录
  ./deploy.sh /opt/proxy       指定部署目录

环境变量:
  DP_CONFIG_PATH   配置文件路径
  DP_HTTPS_CERT    HTTPS 证书路径（手动指定）
  DP_HTTPS_KEY     HTTPS 私钥路径（手动指定）
  .env             自动加载，见 .env.example
EOF
}

gen_certs() {
  local CERT_DIR="${1:-./certs}"
  mkdir -p "$CERT_DIR"
  local CERT="$CERT_DIR/server.crt"
  local KEY="$CERT_DIR/server.key"

  if [ -f "$CERT" ] && [ -f "$KEY" ]; then
    return 0
  fi

  LOCAL_IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
  [ -z "$LOCAL_IP" ] && LOCAL_IP="127.0.0.1"

  if command -v mkcert &>/dev/null; then
    echo "使用 mkcert 生成可信证书 (IP: $LOCAL_IP)..."
    mkcert -cert-file "$CERT" -key-file "$KEY" \
      localhost 127.0.0.1 "$LOCAL_IP" 2>&1
  else
    echo "mkcert 未安装，使用 openssl 生成自签名证书 (IP: $LOCAL_IP)..."
    echo "提示: brew install mkcert && mkcert -install 可生成系统信任的证书"
    openssl req -x509 -nodes -days 365 \
      -subj "/CN=$LOCAL_IP" \
      -addext "subjectAltName=IP:$LOCAL_IP,IP:127.0.0.1,DNS:localhost" \
      -newkey rsa:2048 \
      -keyout "$KEY" \
      -out "$CERT" 2>/dev/null
  fi

  export DP_HTTPS_CERT="$CERT"
  export DP_HTTPS_KEY="$KEY"
}

# 自检测：部署目录无 src/ 但 dist/ 存在 → 生产模式
if [ ! -d "src" ] && [ -d "dist" ]; then
  case "${1:-}" in
    help|--help|-h) show_help; exit 0 ;;
    https)
      gen_certs certs
      echo "=== 生产模式 (HTTPS) ==="
      node dist/index.js ;;
    *) echo "=== 生产模式 ==="; node dist/index.js ;;
  esac
  exit 0
fi

case "${1:-}" in
  help|--help|-h)
    show_help
    exit 0
    ;;
  run)
    echo "=== 单次启动 ==="
    npx tsx src/index.ts
    ;;
  prod)
    if [ ! -d "dist" ]; then
      echo "dist/ 不存在，先运行: npx tsc"
      exit 1
    fi
    echo "=== 生产模式 ==="
    node dist/index.js
    ;;
  https)
    if [ ! -d "dist" ]; then
      echo "dist/ 不存在，正在编译..."
      npx tsc
    fi
    gen_certs certs
    echo "=== 生产模式 (HTTPS) ==="
    node dist/index.js
    ;;
  --config)
    if [ -z "$2" ]; then
      echo "错误: --config 需要指定文件路径"
      exit 1
    fi
    export DP_CONFIG_PATH="$2"
    echo "使用配置: $2"
    echo "=== 开发模式 ==="
    npx tsx src/index.ts
    ;;
  *)
    echo "=== 开发模式 (watch) ==="
    npx tsx watch src/index.ts
    ;;
esac
