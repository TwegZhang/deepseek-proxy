#!/bin/bash
set -e

show_help() {
  cat <<EOF
deepseek-proxy — 轻量级 DeepSeek Anthropic API 代理

用法:
  ./start.sh                   开发模式（tsx watch，HTTP）
  ./start.sh run               单次启动（不 watch）
  ./start.sh prod              生产模式（编译后启动，HTTP）
  ./start.sh https             生产模式 + HTTPS（自动生成自签名证书）
  ./start.sh --config FILE     指定配置文件
  ./start.sh help              显示帮助

部署:
  ./deploy.sh                  编译并准备部署目录
  ./deploy.sh /opt/proxy       指定部署目录

环境变量:
  DP_CONFIG_PATH   配置文件路径
  DP_HTTPS_CERT    HTTPS 证书路径
  DP_HTTPS_KEY     HTTPS 私钥路径
  .env             自动加载，见 .env.example
EOF
}

# 自检测：部署目录无 src/ 但 dist/ 存在 → 生产模式
if [ ! -d "src" ] && [ -d "dist" ]; then
  case "${1:-}" in
    help|--help|-h) show_help; exit 0 ;;
    https)
      if [ ! -f "certs/server.crt" ] || [ ! -f "certs/server.key" ]; then
        LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
        echo "生成自签名证书 (IP: $LOCAL_IP)..."
        mkdir -p certs
        openssl req -x509 -nodes -days 365 \
          -subj "/CN=$LOCAL_IP" \
          -addext "subjectAltName=IP:$LOCAL_IP,IP:127.0.0.1,DNS:localhost" \
          -newkey rsa:2048 \
          -keyout certs/server.key \
          -out certs/server.crt 2>/dev/null
      fi
      export DP_HTTPS_CERT="certs/server.crt"
      export DP_HTTPS_KEY="certs/server.key"
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
    # Generate self-signed certificate
    CERT_DIR="./certs"
    mkdir -p "$CERT_DIR"
    CERT="$CERT_DIR/server.crt"
    KEY="$CERT_DIR/server.key"
    if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
      LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
      echo "生成自签名证书 (IP: $LOCAL_IP)..."
      openssl req -x509 -nodes -days 365 \
        -subj "/CN=$LOCAL_IP" \
        -addext "subjectAltName=IP:$LOCAL_IP,IP:127.0.0.1,DNS:localhost" \
        -newkey rsa:2048 \
        -keyout "$KEY" \
        -out "$CERT" 2>/dev/null
      echo "证书已生成: $CERT"
    fi
    export DP_HTTPS_CERT="$CERT"
    export DP_HTTPS_KEY="$KEY"
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
