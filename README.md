# deepseek-proxy

轻量级代理，填补 DeepSeek Anthropic API 与原生 Anthropic API 之间的能力差异。专为 **Claude Code** 和 **Claude Desktop** 设计。

## 核心功能

- **模型名称双向翻译** — Claude 客户端只能用 Claude 模型名，代理自动翻译为 DeepSeek 模型名，响应中反向翻译
- **图片识别** — Claude Desktop 粘贴截图，代理层通过视觉模型（OpenAI/百炼/火山引擎等）转文字后发给 DeepSeek
- **服务端搜索** — 拦截 tool call，调用 Tavily/Bocha/Brave 搜索 API，注入结果后重入模型
- **参数过滤** — 自动剥离 DeepSeek 不支持的参数（cache_control、citations、top_k 等）
- **速率限制** — 内存滑动窗口，无需 Redis

## 快速开始

```bash
# 1. 安装
npm install

# 2. 配置密钥
cp .env.example .env
vim .env   # 填入 DP_DEEPSEEK_API_KEY 和 DP_PROXY_API_KEY

# 3. 启动
npm run dev
```

## 配置

所有密钥通过 `.env` 配置：

| 变量 | 用途 |
|------|------|
| `DP_DEEPSEEK_API_KEY` | DeepSeek API 密钥（必填） |
| `DP_PROXY_API_KEY` | 代理认证密钥（必填） |
| `DP_VISION_BASE_URL` | Vision API 地址 |
| `DP_VISION_MODEL` | Vision 模型名 |
| `DP_VISION_API_KEY` | Vision API 密钥 |
| `DP_SEARCH_API_KEY` | 搜索 API 密钥 |

功能开关和模型映射在 `config/default.yaml` 中配置。

### Vision 插件

```bash
# .env
DP_VISION_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1  # 阿里百炼示例
DP_VISION_MODEL=qwen-vl-max
DP_VISION_API_KEY=sk-xxx
```

```yaml
# config/default.yaml
plugins:
  vision:
    enabled: true
```

支持任意 OpenAI 兼容视觉接口（OpenAI、阿里百炼、火山引擎、硅基流动、MiniMax、GLM、Moonshot）。

### Search 插件

```bash
# .env
DP_SEARCH_API_KEY=tvly-xxx
```

```yaml
# config/default.yaml
plugins:
  search:
    enabled: true
    provider: tavily   # tavily | bocha | brave
```

## 接入 Claude Code / Desktop

1. 启动代理：`npm run dev`
2. Claude Code/Desktop 设置中：
   - **API Endpoint**: `http://localhost:3000`
   - **API Key**: `.env` 中配的 `DP_PROXY_API_KEY`

## 验证

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/v1/messages \
  -H "x-api-key: sk-proxykey" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}'

npm test
```

## 架构

```
客户端 → auth → rateLimit → parameterFilter → modelTranslate
       → requestTransform → [vision] → DeepSeekProvider
       → modelTranslate → [search] → responseTransform → 响应
```

详见 [DESIGN.md](./DESIGN.md)

## 技术栈

Node.js + Express.js + TypeScript · 零数据库 · 纯内存 + 配置文件驱动

## 分支策略

[简化 Git Flow](./CONTRIBUTING.md) — `main` + `develop` + `feature/*` / `fix/*` / `release/*` / `hotfix/*`
