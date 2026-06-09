# DeepSeek Proxy 设计文档

## 概述

deepseek-proxy 是一个轻量级代理，位于客户端（Claude Code / Claude Desktop / Anthropic SDK）与 DeepSeek Anthropic API 之间，填补两者能力差异。

**核心原则**：零外部依赖（无数据库、无 Redis），纯内存 + 配置文件驱动。

**技术栈**：Node.js + Express.js + TypeScript

## 使用场景

1. **Claude Code / Desktop 接入 DeepSeek** — Claude 客户端只能配 Claude 模型名，代理做双向翻译
2. **截图/图片对话** — Claude Desktop 粘贴截图 → 代理识别图片 → 转文字 → 发给 DeepSeek

## 架构总览

```
客户端 (Claude Code/Desktop/SDK)
  │  POST /v1/messages  (Anthropic API 格式)
  ▼
┌─────────────────────────────────────────────────────┐
│  Express 中间件管道                                  │
│                                                     │
│  auth → rateLimit → parameterFilter                │
│  → modelTranslate(上游) → requestTransform         │
│  → plugin:vision (图片→文字)                        │
│  → proxyRouter → DeepSeekProvider.call()           │
│  → modelTranslate(下游) → responseTransform        │
│  → errorHandler                                    │
└─────────────────────────────────────────────────────┘
  │  Anthropic API 格式
  ▼
DeepSeek API (https://api.deepseek.com/anthropic)
```

## 目录结构

```
src/
├── index.ts                    # 服务启动入口
├── app.ts                      # Express 应用工厂
├── config/                     # 配置系统（YAML + env → Zod）
│   ├── index.ts / schema.ts / default.ts
├── middleware/                  # 中间件管道
│   ├── pipeline.ts             # 管道组装
│   ├── context.ts              # 请求上下文（WeakMap 存取器）
│   ├── auth.ts                 # API Key 认证（单Key/多Key bcrypt）
│   ├── rateLimit.ts            # 内存滑动窗口限流
│   ├── parameterFilter.ts      # 剥离不支持的参数
│   ├── modelTranslate.ts       # 模型名双向翻译
│   ├── requestTransform.ts     # Anthropic → 内部格式
│   ├── responseTransform.ts    # 内部格式 → Anthropic
│   └── errorHandler.ts         # 全局错误处理
├── providers/                  # LLM 供应商
│   ├── interface.ts            # LLMProvider 接口
│   ├── base.ts                 # 基类（重试、特性查询）
│   └── deepseek/index.ts       # DeepSeek 供应商（请求 + SSE流）
├── plugins/                    # 插件系统
│   ├── interface.ts            # Plugin + HookPoint
│   ├── engine.ts               # Hook 引擎（O(1) 按 HookPoint 索引）
│   └── vision/                 # 图片识别插件
│       ├── interface.ts        # VisionProvider 接口
│       ├── openai-compatible.ts # OpenAI 兼容视觉客户端
│       └── index.ts            # VisionPlugin（扫描+转换+替换）
├── models/                     # Anthropic 协议 + 内部类型
├── routes/                     # POST /v1/messages + GET /health
└── utils/
    ├── fetch.ts                # fetchWithTimeout
    ├── stream.ts               # SSE 流解析器
    ├── logger.ts               # pino 日志
    └── errors.ts               # 错误类层次
```

## 核心设计

### 1. 中间件管道

每个中间件是标准 `(req, res, next)` 函数，职责单一、可独立测试。

| 序号 | 中间件 | 职责 |
|------|--------|------|
| 1 | auth | 提取 `x-api-key`，验证 |
| 2 | rateLimit | 内存滑动窗口，按 IP 计数 |
| 3 | parameterFilter | 剥离不支持的参数（`top_k`、`cache_control` 等） |
| 4 | modelTranslate | 请求方向：Claude 模型名 → DeepSeek 模型名 |
| 5 | requestTransform | Anthropic 格式 → 内部 ProviderRequest |
| 6 | vision 插件 | 扫描 `image` 块 → 调视觉模型 → 替换为文字 |
| 7 | proxyRouter | 调用 DeepSeekProvider（流/非流） |
| 8 | modelTranslate | 响应方向：DeepSeek 模型名 → Claude 模型名 |
| 9 | responseTransform | 内部 ProviderResponse → Anthropic 格式 |

### 2. 请求上下文（context.ts）

中间件之间通过 `WeakMap<Request, Record<string, unknown>>` 传递数据，避免 `req` 挂属性的类型不安全：

```typescript
setProviderRequest(req, providerReq);  // 上游写入
getProviderRequest(req);               // 下游读取
```

### 3. 模型名称双向翻译

```
请求方向：claude-sonnet-4-20250514 → deepseek-v4-flash
响应方向：deepseek-v4-flash         → claude-sonnet-4-20250514
```

映射表通过 `model_mapping` 配置，未匹配走 `default`。反向翻译遍历 mapping 查表。

### 4. Vision 插件

**时机**：供应商调用前（PRE_PROCESS）
**流程**：
1. 扫描所有消息中的 `type: "image"` content block
2. 提取 base64 数据，并行调用视觉模型（Promise.all）
3. 将 image 块替换为 `[Image: 描述文字]`
4. 无图片时提前返回（零开销）

**配置**：三个环境变量驱动，支持任意 OpenAI 兼容视觉接口：
```bash
DP_VISION_BASE_URL=https://api.openai.com/v1
DP_VISION_MODEL=gpt-4o
DP_VISION_API_KEY=sk-xxx
```

### 5. 速率限制

`MemoryRateLimiter` — 纯内存实现：
- 请求频率：60 秒滑动窗口
- 并发控制：活跃请求数上限
- 5 分钟清理过期桶
- 上限 10000 IP 桶防内存攻击

### 6. DeepSeek 供应商

封装 `https://api.deepseek.com/anthropic` 调用：
- **非流式**：POST → JSON 响应
- **流式**：POST (stream:true) → SSE 逐行解析 → AsyncIterable
- **超时**：配置 `timeout_ms`，默认 120 秒
- **复用**：`fetchAPI()` 共享超时 + 错误处理
- **断连保护**：客户端断开时中止上游流（避免浪费 token）

### 7. 错误处理

| 错误类 | HTTP | 场景 |
|--------|------|------|
| `AuthError` | 401 | API Key 无效 |
| `RateLimitError` | 429 | 频率/并发超限 |
| `ProviderError` | 上游状态码 | API 错误 |
| `ConfigurationError` | 500 | 配置无效 |

## 配置

三层加载（优先级低→高）：
1. `src/config/default.ts` — 硬编码默认值
2. `config/default.yaml` — YAML 文件
3. 环境变量 — `.env` 或系统 env

启动时 Zod schema 校验。密钥全走环境变量。

### 关键环境变量

| 变量 | 用途 |
|------|------|
| `DP_DEEPSEEK_API_KEY` | DeepSeek API 密钥 |
| `DP_PROXY_API_KEY` | 代理认证密钥 |
| `DP_VISION_BASE_URL` | Vision API 地址 |
| `DP_VISION_MODEL` | Vision 模型名 |
| `DP_VISION_API_KEY` | Vision API 密钥 |

## 测试

- 框架：vitest
- 覆盖：13 文件 / 52 用例 / 全部通过
- 分类：中间件(38) + 工具(11) + 插件(3)
