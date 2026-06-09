#!/bin/bash
set -e

show_help() {
  cat <<EOF
deepseek-proxy — 轻量级 DeepSeek Anthropic API 代理

用法:
  ./start.sh                   默认启动（开发模式，tsx watch）
  ./start.sh prod              生产模式（编译后启动）
  ./start.sh deploy            部署模式（deploy.sh + 生产启动）
  ./start.sh --config FILE     指定配置文件启动
  ./start.sh help              显示帮助

环境变量:
  DP_CONFIG_PATH   配置文件路径（优先于 --config）
  .env             自动加载，见 .env.example
EOF
}

case "${1:-}" in
  help|--help|-h)
    show_help
    exit 0
    ;;
  prod)
    echo "=== 生产模式 ==="
    npx tsc
    node dist/index.js
    ;;
  deploy)
    echo "=== 部署模式 ==="
    bash deploy.sh
    cp .env deploy/.env 2>/dev/null || true
    cd deploy && node dist/index.js
    ;;
  --config)
    if [ -z "$2" ]; then
      echo "错误: --config 需要指定文件路径"
      echo "用法: ./start.sh --config /path/to/config.yaml"
      exit 1
    fi
    export DP_CONFIG_PATH="$2"
    echo "使用配置: $2"
    echo "=== 开发模式 ==="
    npx tsx src/index.ts
    ;;
  *)
    echo "=== 开发模式 (npm run dev) ==="
    npx tsx watch src/index.ts
    ;;
esac
