#!/bin/bash
set -e

show_help() {
  cat <<EOF
deepseek-proxy — DeepSeek Anthropic API 代理

用法:
  ./start.sh                   开发模式（tsx watch，文件变更自动重启）
  ./start.sh run               单次启动
  ./start.sh prod              生产模式（编译后启动）
  ./start.sh --config FILE     指定配置文件
  ./start.sh help              帮助

部署:
  ./deploy.sh                  编译并准备部署目录
  ./deploy.sh /opt/proxy       指定部署目录
EOF
}

# 部署目录自检测：无 src/ 但 dist/ 存在 → 生产模式
if [ ! -d "src" ] && [ -d "dist" ]; then
  export DP_LOG_FILE="${DP_LOG_FILE:-./logs/proxy.log}"
  case "${1:-}" in
    help|--help|-h) show_help; exit 0 ;;
    *) echo "=== 生产模式 (log: $DP_LOG_FILE) ==="; node dist/index.js ;;
  esac
  exit 0
fi

case "${1:-}" in
  help|--help|-h) show_help; exit 0 ;;
  run) echo "=== 单次启动 ==="; npx tsx src/index.ts ;;
  prod)
    [ ! -d "dist" ] && { echo "dist/ 不存在: npx tsc"; exit 1; }
    echo "=== 生产模式 ==="; node dist/index.js ;;
  --config)
    [ -z "$2" ] && { echo "用法: ./start.sh --config FILE"; exit 1; }
    export DP_CONFIG_PATH="$2"
    echo "配置: $2"; npx tsx src/index.ts ;;
  *)
    echo "=== 开发模式 (watch) ==="
    npx tsx watch src/index.ts ;;
esac
