# Vibe Coding 详细案例：deepseek-proxy

## 项目背景

构建轻量级代理，填补 DeepSeek Anthropic API 与原生 Anthropic API 的能力差异，供 Claude Code/Desktop 接入。

**技术栈**：Node.js + Express + TypeScript · 零数据库/零 Redis · 纯内存 + 配置文件驱动  
**产出**：32 源文件 (1458行) + 13 测试文件 (52用例) + 文档 + 部署脚本 + 60 次提交  
**方式**：全程 Claude Code 对话驱动，无手动编辑代码

---

## 第一章：基础设施与 Phase 1

### 步骤 1：分支策略

```
用户：帮我设计一下 main develop 等分支管理。符合 github 的推荐规范和操作方式。在社区中显得足够专业
```

```
Agent：读取仓库状态 → 设计简化 Git Flow → 创建 develop 分支 → 创建 .github/ 目录
  → 写入 PR 模板 + Issue 模板 + CONTRIBUTING.md
```

```bash
git branch develop main
mkdir -p .github/ISSUE_TEMPLATE
# 创建 .github/PULL_REQUEST_TEMPLATE.md .github/ISSUE_TEMPLATE/bug_report.md .github/ISSUE_TEMPLATE/feature_request.md
# 创建 CONTRIBUTING.md 更新 README.md
git add README.md .github/ CONTRIBUTING.md
git commit -m "docs: add branch strategy, PR/issue templates, and contributing guide"
git push origin main develop
```

```
用户：请用中文介绍一下我再决策
Agent：中文解释简化 Git Flow → 用户同意 → 开干
```

### 步骤 2：整体架构设计

```
用户：我们现在开始整体设计和开发
```

```
Agent：git checkout develop → 调研 DeepSeek Anthropic API 文档 → 分析能力差异
  → 向用户提问（核心目标/技术栈/语言/API范围）→ 用户回答
  → 设计架构（目录结构、14步中间件管道、供应商抽象、插件系统、6阶段计划）
```

**调研发现**：DeepSeek 不支持 image/document/search_result/cache_control/citations/top_k/thinking.budget_tokens

**用户关键输入**：
- 核心：代理 DeepSeek /anthropic 端点 + 补充能力差异
- 服务端搜索（Bocha/Tavily/Brave）+ 图片识别（vision model 转文字）
- Express + TypeScript
- **增加模型名称翻译**：Claude Code/Desktop 升级后只能配 Claude 模型名
- **Claude Desktop 截图粘贴**：base64 图片在代理层处理，不用文件路径

**用户反馈**："我希望这是一个轻量级的工具，尽量不使用数据库和redis"
→ Agent 砍掉所有存储抽象和 Redis → 纯内存 + YAML 配置文件驱动

### 步骤 3：实现 Phase 1 核心代理

```
用户：好的。开干吧。
```

```bash
# 创建 package.json + tsconfig.json + 安装依赖
npm install    # express, zod, js-yaml, pino, bcryptjs, dotenv, typescript, tsx, vitest

# 按依赖顺序创建 28 个源文件：
src/utils/logger.ts          # pino 日志
src/utils/errors.ts           # AuthError/RateLimitError/ProviderError/ConfigurationError
src/models/anthropic.ts       # Anthropic API 类型（ContentBlock/Message/MessagesRequest）
src/models/provider.ts        # 内部类型（ProviderRequest/ProviderResponse/ProviderStreamChunk）
src/config/schema.ts          # Zod schema
src/config/default.ts         # 硬编码默认值
src/config/index.ts           # YAML + env + Zod 加载器
config/default.yaml           # YAML 配置
.env.example                  # 环境变量模板
src/providers/interface.ts    # LLMProvider 接口
src/providers/deepseek/index.ts  # DeepSeek 供应商（请求+SSE流）
src/middleware/auth.ts         # API Key 认证
src/middleware/rateLimit.ts    # 内存滑动窗口限流
src/middleware/parameterFilter.ts  # 参数过滤（剥离不支持的参数）
src/middleware/modelTranslate.ts   # 模型名双向翻译
src/middleware/requestTransform.ts  # Anthropic → 内部格式
src/middleware/responseTransform.ts # 内部格式 → Anthropic
src/middleware/errorHandler.ts      # 全局错误处理
src/middleware/context.ts     # WeakMap 请求上下文
src/middleware/pipeline.ts    # 10步管道组装
src/plugins/interface.ts      # Plugin + HookPoint
src/plugins/engine.ts         # Hook 引擎
src/routes/v1/messages.ts     # POST /v1/messages
src/routes/index.ts           # 路由挂载
src/app.ts                    # Express 应用工厂
src/index.ts                  # 启动入口
```

```bash
npx tsc --noEmit    # 11 处类型错误
# 修复：as Record<string,unknown> 强转、pipeline 隐式 any、res.end 签名等
git commit -m "feat: implement Phase 1 — core proxy with model translation"
```

### 步骤 4：代码审查 + 单元测试 + 集成验证

```
用户：/code-review
```

```
Agent：启动三路并行审查 agent（reuse/quality/efficiency）
  → 发现 11 个问题 → 全部修复
```

**审查发现**（6 HIGH + 3 MEDIUM + 2 LOW）：
| 问题 | 修复 |
|------|------|
| bcrypt.compareSync 阻塞事件循环 | → async bcrypt.compare() |
| 速率限制 tokens 字段死代码 | → 移除 |
| 速率限制内存泄漏(res.on("finish")) | → 监听 close+error |
| 插件调度 O(n×m) 扫描 | → 按 HookPoint 索引 O(1) |
| Schema 缺失字段导致大量 as 强转 | → 补全 Zod schema |
| fetch 模板重复 | → 提取 fetchAPI() |

```bash
git commit -m "fix: code review — async bcrypt, WeakMap req data, O(1) plugin dispatch"
```

```
用户：好的。按照建议进行，并且使用默认的loop模式（写测试 + 验证）
```

```bash
# 创建 vitest.config.ts 和 9 个测试文件
npm test    # 36 tests passed

# 创建 .env 填入真实密钥
cp .env.example .env
vim .env  # DP_DEEPSEEK_API_KEY=sk-xxx  DP_PROXY_API_KEY=sk-proxykey

npm run dev

# 端到端验证
curl http://localhost:3000/health
curl -X POST http://localhost:3000/v1/messages \
  -H "x-api-key: sk-proxykey" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":100,"messages":[{"role":"user","content":"say hi"}]}'
# → model:claude-sonnet-4-20250514 tokens:6+84 stop:end_turn ✓
```

```bash
git commit -m "test: add 9 test files (36 tests) for middleware, utils, and plugins"
git commit -m "chore: add .env to .gitignore, verify integration test"
```

---

## 第二章：Phase 2 — Vision 插件

### 步骤 5：初始实现与配置迭代

```
用户：继续Phase 2。使用openai兼容的接口格式。支持国内厂商（百炼/火山引擎/硅基流动/MiniMax/GLM/Kimi/豆包）
```

```bash
# 创建插件文件
src/plugins/vision/interface.ts      # VisionProvider 接口
src/plugins/vision/openai-compatible.ts  # OpenAI 兼容客户端（单一实现适配所有厂商）
src/plugins/vision/index.ts          # VisionPlugin（PRE_PROCESS 钩子）
```

**设计决策**：所有国内厂商都用 `/v1/chat/completions` 格式，一个 `OpenAIVisionProvider` 适配全部。
```
POST /v1/chat/completions → { model, messages: [{ role:"user", content:[{text},{image_url}] }] }
```

```bash
git commit -m "feat: Phase 2 — Vision plugin with OpenAI-compatible multi-provider support"
```

```
用户：所有配置放在.env，统一 url/模型名/key
```

**Agent**：砍掉 YAML 里的 providers 列表。在 config/default.yaml 和 .env.example 中列出 7 个厂商的 URL 和模型名作为注释参考。

```bash
git commit -m "refactor: simplify vision config to env-only"
git commit -m "docs: add vision provider examples in config files"
```

```bash
# 审查 + 修复
git commit -m "fix: code review Phase 2 — extract fetchWithTimeout, fix error handling"
```

### 步骤 6：Vision 插件调试 — 5 层定位

这是整个项目最复杂的调试过程，从"完全无输出"到"正常工作"，跨越 5 个层次的问题。

#### 第 1 层：parameterFilter 过滤了 image 块

**现象**：Vision 启动日志正常（"Vision plugin ready"），但发送截图后无任何 vision 处理日志。

```
Agent 操作 1：加 block type 扫描日志到 vision/index.ts
  → 日志：msgCount:23, 无 image block
```

```
Agent 操作 2：加 messages body 日志到 app.ts（记录 req.body 结构）
  → 日志：req.body 中有 type:"image", hasSource:true  ← 有！
  → vision 插件：blockTypes:["text","thinking","tool_use","tool_result"]  ← 无！
```

**矛盾**：两个代码都读 req.body，一个看到 image，一个看不到。

```
Agent 操作 3：改从 ctx.req.body 直接读取，绕过 providerRequest
  → 仍然没有 image！
```

```
Agent 操作 4：搜索 "image" 关键词排查中间件
grep -rn "image" src/middleware/
  → parameterFilter.ts 第 5 行：UNSUPPORTED_CONTENT = ["image", "document", ...]
```

**根因**：`parameterFilter.ts` 在 vision 前运行，从 req.body 中过滤了所有 image 块。Phase 1 时的合理设计（剥离 DeepSeek 不支持的 image）成了 Phase 2 的陷阱。

```bash
# 修复
# 1. parameterFilter.ts：UNSUPPORTED_CONTENT 移除 "image"
# 2. pipeline.ts：vision 插件调到 parameterFilter 之前
git commit -m "fix: remove \"image\" from UNSUPPORTED_CONTENT, move parameterFilter after vision"
```

#### 第 2 层：数据写回遗漏

**现象**：修复后 vision 检测到 image、处理成功，但 DeepSeek 还是收到原始 image block → "[Unsupported Image]"。

```bash
# 排查：vision 处理完的 text 描述存在本地 messages 变量中，但没写回 ctx.providerRequest.messages
# proxy router 读取的是 ctx.providerRequest.messages → 还是旧的（有 image）

# 修复：加一行
ctx.providerRequest!.messages = messages;
git commit -m "fix: write modified messages back to ctx.providerRequest for proxy router"
```

#### 第 3 层：Qwen thinking 模型 content 为空

**现象**：12 张图片全部 "Vision API returned empty response"。

```
Agent 操作 1：加 API 响应详情日志
  → status:200, hasChoices:true
  → msgKeys:["role","content","reasoning_content"]
  → 但 content=""  ← 空的！
  → 全部落入 Vision API call failed
```

**用户操作**：创建 `test-qwen/` 独立测试脚本（绕开代理，直接用 node 调 SiliconFlow API）

```bash
mkdir test-qwen
echo "test-qwen/" >> .gitignore
# 创建 test-qwen/test-vision.js — 读 .env + a.png → 直接调 API → 写日志文件

# 用户放入 a.png 后运行：
node test-qwen/test-vision.js
```

**关键日志**：
```json
{
  "choices": [{
    "message": {
      "content": "",                           // 空的
      "reasoning_content": "The image shows a macOS Finder window..."  // 内容全在这
    },
    "finish_reason": "length"                   // 被截断
  }]
}
```

**Agent 查阅文档**：Qwen 思考模型在回答前先做思维链推理。推理写入 `reasoning_content`，最终答案写入 `content`。max_tokens=512 太小，推理阶段就耗完了所有 token。

```bash
# 三层修复：
# 1. content || reasoning_content 回退
git commit -m "fix: fall back to reasoning_content when content is empty"
# 2. max_tokens 512→1024→4096
git commit -m "fix: increase vision max_tokens for Qwen thinking models"
# 3. thinking_budget 限制推理占 40%
git commit -m "fix: add thinking_budget to prevent Qwen eating all tokens"
```

#### 第 4 层：超时

**现象**："This operation was aborted" → AbortError

```
fetchWithTimeout 30s → 105KB 图片 + Qwen 推理 > 30s
```

```bash
# openai-compatible.ts：30_000 → 120_000
git commit -m "fix: increase vision API timeout 30s→120s"
```

#### 第 5 层：历史图片干扰

**现象**：每次处理 12 张图片（全部从对话历史中）

```bash
# vision/index.ts：只扫描最后一条 user 消息，跳过 data < 100 字节的无效数据
git commit -m "fix: process only last user message images, log vision API response"
```

### Vision 调试完整流程总结

```
第1层：vision 无输出  → parameterFilter 过滤 image  → 黑名单+调顺序
第2层：DeepSeek 看不到  → 没写回 messages             → ctx.providerRequest.messages = messages
第3层：API 返回空       → Qwen content="" reasoning有内容 → content||reasoning_content + max_tokens→4096
第4层：超时            → 30s不够                      → 120s
第5层：历史干扰        → 12张全处理全失败               → 只处理最后一个
```

---

## 第三章：Phase 3 — 搜索插件

```
用户：继续 Phase 3
```

```bash
# 创建搜索插件 + 三个适配器
src/plugins/search/interface.ts
src/plugins/search/providers/tavily.ts
src/plugins/search/providers/bocha.ts
src/plugins/search/providers/brave.ts
src/plugins/search/index.ts

# 搜索流程：
DeepSeek 返回 tool_use(web_search) → 拦截 → 调搜索API → tool_result → 重入
```

```bash
git commit -m "feat: Phase 3 — Search plugin with Tavily/Bocha/Brave providers"
git commit -m "feat: search re-entry — pipeline re-calls provider with tool_results"
```

```bash
# 代码审查发现问题：
# _searchReentry 通过 as Record 不安全强转 → 加到 HookContext 类型
# 重入时 POST_CALL 再次搜索浪费 API → one-shot guard
git commit -m "fix: code review Phase 3+4 — typed searchReentry, one-shot guard"
```

**第一性原理检查**：
```bash
# 三搜索适配器 70% 拷贝 → 合并为配置驱动工厂
rm src/plugins/search/providers/bocha.ts tavily.ts brave.ts
# 创建 src/plugins/search/providers.ts (统一工厂)

# 删除死代码
rm src/providers/base.ts    # 单供应商不需要基类
rm src/proxy/fallback.ts    # FallbackChain 从未被调用
# 简化配置 env override（6个重复if块 → setNested函数）
```

```bash
git commit -m "refactor: first-principles cleanup — remove dead code, merge adapters"
```

---

## 第四章：Phase 4 — 基础设施完善

### 步骤 7：降级链 + Docker

```
用户：继续 Phase 4
```

```bash
# 创建 src/proxy/fallback.ts + Dockerfile + docker-compose.yml + .dockerignore
git commit -m "feat: Phase 4 — fallback chain + Docker deployment"
```

### 步骤 8：部署脚本完善

```
用户：写一个部署脚本，避免在代码库里边进行测试和部署
```

```bash
# 创建 deploy.sh（编译→拷贝dist/config/pkgs→安装生产依赖）
# 创建 start.sh（dev/run/prod/--config 模式）
chmod +x deploy.sh start.sh

# 用户反馈后的迭代：
# 1. deploy.sh 也拷贝 .env 和 start.sh
# 2. deploy 后也用 start.sh 启动
# 3. start.sh 自检测部署环境（无src/有dist → 生产模式）
```

```bash
git commit -m "feat: add deploy.sh — build and deploy to isolated directory"
git commit -m "feat: add start.sh with subcommands + DP_CONFIG_PATH env support"
git commit -m "refactor: clean separation — deploy.sh builds, start.sh starts"
```

### 步骤 9：HTTPS 探索（最终回退）

```
用户：Claude Desktop 要求必须使用 https。100.83.145.48 是我的 Mac mini LAN IP
```

```bash
# 添加 HTTPS 支持（self-signed certs + mkcert + Let's Encrypt）
# 研究 CCSwitch 后用户发现：Electron 对 localhost HTTP 有豁免

用户决策：删除所有关于 https 和证书相关的内容。只保留 http。127.0.0.1 本地访问。

# 回退：删除 ~120 行证书相关代码
git commit -m "refactor: remove all HTTPS/certificate support — HTTP only for localhost"
```

### 步骤 10：Log 级别问题

```
用户：我在.env中启动了LOG_LEVEL=debug为什么没有debug日志打印
```

```
Agent 分析：
1. 部署时 .env 没拷贝到 deploy/.env → 重新部署解决
2. 增加了 DP_LOG_FILE 文件日志，便于 agent 自主读取
3. 把关键诊断日志从 WARN 降到 INFO/DEBUG（去除污染）
```

### 步骤 11：文档收尾

```
用户：书写和补全 README / 更新设计文件
```

```bash
# 更新 README.md (快速开始/配置/接入指南/验证)
# 更新 DESIGN.md (架构/10步管道/search插件/配置系统)
# 恢复 CONTRIBUTING.md
# 创建 VIBE_CODING_CASE_STUDY.md
```

---

## 调试方法论

### Vision 插件五层定位

| 层 | 现象 | 工具 | 定位手法 | 根因 |
|---|------|------|----------|------|
| 1 | vision 无输出 | 添加 block type 日志 | 对比 req.body vs vision 收到的数据 | parameterFilter 过滤 |
| 2 | DeepSeek 看不到 | 对比 messages body vs ctx | 追踪变量引用 | 没写回 ctx |
| 3 | API 返回空 | test-qwen/ 独立脚本 | 绕开代理，直接调 API | Qwen thinking 模型 content="" |
| 4 | 超时 | 日志 AbortError | 看错误类型和计时 | 30s 不够 |
| 5 | 历史图片 | 计数分析 | 发现 12 张全失败 | source.data 过期 |

### 核心原则

1. **先确认数据到哪一步** — 从最外层逐层加日志，精确定位丢失点
2. **单独测试依赖服务** — 独立脚本绕开代理，10 分钟 vs 几小时
3. **每个中间件都可能是嫌疑人** — Phase 1 的合理设计 = Phase 2 的陷阱
4. **思考模型不是普通 LLM** — 特殊的 API 行为
5. **超过 3 轮换方式** — 不在增量修补中打转

---

## 统计

| 指标 | 数值 |
|------|------|
| Git 提交 | 60 |
| 源文件 | 32 (1458 行) |
| 测试文件 | 13 (52 用例) |
| 删除的死代码 | ~150 行 |
| 最大调试轮数 | 5 (vision 插件) |
| 独立测试脚本 | 1 (test-qwen/) |
| 代码审查轮数 | 4 轮 |
| 架构回退次数 | 3 (HTTPS/providers列表/配置层) |
