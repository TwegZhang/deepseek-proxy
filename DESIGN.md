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
│  → plugin:search (拦截tool_use→搜索→重入)          │
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
│   └── deepseek/index.ts       # DeepSeek 供应商（请求 + SSE流）
├── plugins/                    # 插件系统
│   ├── interface.ts            # Plugin + HookPoint
│   ├── engine.ts               # Hook 引擎（O(1) 按 HookPoint 索引）
│   ├── vision/                 # 图片识别插件
│   │   ├── interface.ts        # VisionProvider 接口
│   │   ├── openai-compatible.ts # OpenAI 兼容视觉客户端
│   │   └── index.ts            # VisionPlugin（扫描+转换+替换）
│   └── search/                 # 搜索插件
│       ├── interface.ts        # SearchProvider + SearchResult
│       ├── providers.ts        # 配置驱动搜索工厂（Tavily/Bocha/Brave）
│       └── index.ts            # SearchPlugin（拦截tool_use→搜索→重入）
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
| 7 | proxyRouter | 调用 DeepSeekProvider（流/非流，支持搜索重入） |
| 8 | search 插件 | 拦截 `tool_use` → 搜索 API → `tool_result` → 重入 |
| 9 | modelTranslate | 响应方向：DeepSeek 模型名 → Claude 模型名 |
| 10 | responseTransform | 内部 ProviderResponse → Anthropic 格式 |

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

嫁接方案（视觉模型转文字 → 文字喂给 DeepSeek）有三类固有失真：信息扭曲、漏关键细节、理解不一致。Vision 插件用"结构化转录 + 按需二次识别"两层机制对抗。

#### 4.1 结构化转录（PRE_PROCESS）

1. 扫描**所有消息**的 `type: "image"` block（客户端每轮重发完整历史，历史图片同样处理）
2. 转录缓存查询（图片内容 SHA-256 → 转录文本，LRU 200）；未命中才调视觉模型
3. 转录 prompt（`prompt.ts`）：转录优先于解读——逐字文本/布局/图表数据/不确定性分节输出，看不清标 `[illegible]`、截断标 `[truncated]`，禁止编造；**上下文感知**：最后一条 user 消息的提问文字传给视觉模型，重点转录相关区域，描述语言跟随提问语言
4. image 块替换为 `<image_transcription image="N">` 包装（含可靠性声明，告知 DeepSeek 这是有误差边界的二手转述）
5. 无图片时提前返回（零开销）

#### 4.2 按需二次识别（POST_CALL，`on_demand_analysis` 开关）

一次性转录再好也有上限——转录漏了细节时 DeepSeek 需要自救通道：

1. 对话含图时注入代理私有工具 `analyze_image`，原图暂存于请求上下文（WeakMap，随请求释放）
2. DeepSeek 思考后发现转录不足 → `tool_use(analyze_image, {image_index, query})` → 插件拦截，把 **DeepSeek 自己生成的分析需求**作为上下文再调视觉模型 → 注入 `tool_result` → 重入（单请求内闭环，3 轮预算）
3. 重入 assistant 轮保留 thinking 块，保证非连续思考的推理链连续
4. **流式**：含图请求内部改非流式跑完工具循环，最终响应合成 Anthropic SSE 回放（`replayAsSSE`）；循环期间每 15s 发 `ping` 保活；客户端断连中止循环
5. **泄漏兜底**：混合调用（analyze_image + 客户端工具）透传前、重入上限耗尽后，pipeline 统一剥离 analyze_image tool_use 并修正 stop_reason——客户端永远不会看到它不认识的工具

#### 4.3 缓存不变量（DeepSeek 前缀缓存保护）

DeepSeek 上下文缓存按前缀匹配计价（命中约 1/10 价格），代理必须保证发给它的历史逐字节稳定：

| 不变量 | 机制 |
|--------|------|
| 转录是纯函数 | 图片 hash → 恒定文本（转录缓存），同图跨轮次/跨会话文本一致 |
| 包装文本稳定 | 编号不含总数（`image="1"` 而非 `1/2`），新图不改写历史包装 |
| 工具注入稳定 | 注入条件 = "对话中存在图片"，与请求边界无关；有图对话轮轮注入 |
| 隐藏轮零污染 | 重入轮不进客户端历史，下轮前缀仍与上轮逐字匹配 |

请求内重入是前缀增长模式，天然高命中。已知残余 miss：代理重启丢内存缓存（可选磁盘持久化）、首次贴图轮 tools 变化。

#### 4.4 架构边界：代理闭环 vs MCP

两层循环并存，控制权分属两端：**客户端 harness 的 agent loop**（Claude Code 的 Bash/Read 等工具，代理逐请求透传、不干预）；**代理内部微循环**（仅 analyze_image，单请求内闭环，对客户端透明）。对话上下文始终归客户端（每轮全量重发），代理只持有内容寻址的转录缓存，不持久化任何对话状态。

与 MCP 方案（客户端装 image-analysis MCP server）的取舍：

| 维度 | 代理闭环（当前） | MCP 方案 |
|------|----------------|----------|
| 图片可达性 | ✅ 原图只经过代理 | ❌ **粘贴截图拿不到**——MCP 参数由模型生成（路径/URL），无法传 image block |
| 使用方式 | 客户端零配置，任何客户端生效 | 每台机器装 server + 配视觉 key，仅 MCP 客户端 |
| 透明度 | 中间过程仅代理日志可见 | ⭐ UI 可见、可审批 |
| agent 循环 | 不触碰客户端循环；跨客户端工具边界有"失忆+自愈"权衡 | ⭐ harness 原生，结论进历史无失忆 |
| 上下文占用 | 隐藏轮零占用 | 中间轮永久占据上下文窗口 |
| 前缀缓存 | 稳定（见 4.3） | 更稳（工具恒在），但历史更长 |

**结论**：粘贴截图场景（Claude Desktop 主场景）MCP 被图片可达性封死，代理闭环是唯一可落地方案；磁盘图片文件场景（Claude Code）MCP 更自然，未来需要时可作为独立补充，与代理互不干扰。

**配置**：
```bash
DP_VISION_BASE_URL=https://api.openai.com/v1
DP_VISION_MODEL=gpt-4o
DP_VISION_API_KEY=sk-xxx
DP_VISION_THINKING_BUDGET=1638   # thinking 模型（Qwen/DeepSeek 等）推理 token 上限
```
```yaml
plugins:
  vision:
    enabled: true
    max_tokens: 4096
    on_demand_analysis: true   # 按需二次识别开关
    # prompt: |                # 自定义转录模板（{USER_CONTEXT} 占位符）
```

### 5. Search 插件

**时机**：供应商调用后（POST_CALL）
**流程**：
1. DeepSeek 返回 `tool_use(type=web_search)` → 插件拦截
2. 提取查询，调用搜索 API（Tavily/Bocha/Brave）
3. 格式化 `tool_result`，追加到消息列表
4. 设置 `ctx.searchReentry = true`，触发 pipeline 第二次调用 DeepSeek
5. 第二次调用携带搜索结果，DeepSeek 返回基于搜索的回复
6. one-shot guard 防止无限重入（pipeline 层重入循环已泛化，硬上限 5 轮，search/vision 插件共用）

**搜索供应商**：配置驱动工厂（`providers.ts`），每个供应商仅定义 URL、请求头、响应解析——无需独立类文件。

```yaml
plugins:
  search:
    enabled: true
    provider: tavily   # tavily | bocha | brave
```

### 6. 速率限制

`MemoryRateLimiter` — 纯内存实现：
- 请求频率：60 秒滑动窗口
- 并发控制：活跃请求数上限
- 5 分钟清理过期桶
- 上限 10000 IP 桶防内存攻击

### 7. DeepSeek 供应商

`implements LLMProvider`，直接实现无基类。封装 `https://api.deepseek.com/anthropic` 调用：
- **非流式**：POST → JSON 响应
- **流式**：POST (stream:true) → SSE 逐行解析 → AsyncIterable
- **超时**：配置 `timeout_ms`，默认 120 秒
- **复用**：`fetchAPI()` 共享超时 + 错误处理
- **断连保护**：客户端断开时中止上游流（避免浪费 token）

### 8. 错误处理

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
| `DP_SEARCH_API_KEY` | 搜索 API 密钥 |

## 测试

- 框架：vitest
- 覆盖：15 文件 / 67 用例 / 全部通过
- 分类：中间件 + 工具 + 插件（含转录 prompt、按需二次识别拦截、SSE 回放）
