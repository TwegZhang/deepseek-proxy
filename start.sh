#!/bin/bash
set -e

show_help() {
  cat <<EOF
deepseek-proxy — 轻量级 DeepSeek Anthropic API 代理

用法:
  ./start.sh                   开发模式（tsx watch，文件变更自动重启）
  ./start.sh run               单次启动（不 watch）
  ./start.sh prod              生产模式（编译后启动）
  ./start.sh --config FILE     指定配置文件
  ./start.sh help              显示帮助

部署:
  ./deploy.sh                  编译并准备部署目录
  ./deploy.sh /opt/proxy       指定部署目录

环境变量:
  DP_CONFIG_PATH   配置文件路径
  .env             自动加载，见 .env.example
EOF
}

# 自检测：部署目录无 src/ 但 dist/ 存在 → 生产模式
if [ ! -d "src" ] && [ -d "dist" ]; then
  case "${1:-}" in
    help|--help|-h) show_help; exit 0 ;;
    *) echo "=== 生产模式 (部署环境) ==="; node dist/index.js ;;
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
