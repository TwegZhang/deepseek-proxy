import { createHash } from "node:crypto";
import type { Logger } from "../../utils/logger";
import type { ContentBlock } from "../../models/anthropic";
import { HookPoint, type HookContext, type HookResult, type Plugin } from "../interface";
import { OpenAIVisionProvider } from "./openai-compatible";
import { buildVisionPrompt, wrapDescription, ANALYZE_IMAGE_TOOL } from "./prompt";
import { setProxyWarnings, getProxyWarnings, setVisionImages, getVisionImages } from "../../middleware/context";
import { getConfig } from "../../config";

/** 按需二次识别轮数上限（超限后 tool_result 返回预算耗尽提示） */
const MAX_ANALYSIS_ROUNDS = 3;

/**
 * 转录缓存：图片内容 hash → 转录文本。
 * 双重作用：1) 历史图片不重调视觉 API；2) 同一图片跨轮次转录文本恒定，
 * 保持发给 DeepSeek 的前缀稳定 → 命中 DeepSeek 上下文缓存（缓存价约为全价 1/10）。
 */
const transcriptionCache = new Map<string, string>();
const TRANSCRIPTION_CACHE_MAX = 200;

function imageCacheKey(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function cacheTranscription(key: string, text: string): void {
  if (transcriptionCache.size >= TRANSCRIPTION_CACHE_MAX) {
    // Map 按插入序迭代，删除最老的一条
    const oldest = transcriptionCache.keys().next().value;
    if (oldest) transcriptionCache.delete(oldest);
  }
  transcriptionCache.set(key, text);
}

export class VisionPlugin implements Plugin {
  readonly id = "vision";
  readonly name = "Image Understanding";
  readonly hooks = [HookPoint.PRE_PROCESS, HookPoint.POST_CALL];

  private provider: OpenAIVisionProvider | null = null;

  constructor(private logger: Logger) {}

  async initialize(): Promise<void> {
    const baseUrl = process.env.DP_VISION_BASE_URL;
    const apiKey = process.env.DP_VISION_API_KEY;
    if (!baseUrl || !apiKey) {
      this.logger.warn("Vision plugin disabled — set DP_VISION_BASE_URL and DP_VISION_API_KEY in .env");
      return;
    }

    const config = getConfig();
    const model = process.env.DP_VISION_MODEL || config.plugins.vision.model;
    const thinkingBudgetEnv = process.env.DP_VISION_THINKING_BUDGET;
    const thinkingBudget = thinkingBudgetEnv ? parseInt(thinkingBudgetEnv, 10) : config.plugins.vision.thinking_budget;

    this.provider = new OpenAIVisionProvider(this.logger, {
      base_url: baseUrl,
      api_key: apiKey,
      model,
      max_tokens: config.plugins.vision.max_tokens,
      thinking_budget: thinkingBudget,
    });

    this.logger.info({ baseUrl, model }, "Vision plugin ready");
  }

  async execute(hook: HookPoint, ctx: HookContext): Promise<HookResult> {
    if (!this.provider) return {};
    if (hook === HookPoint.POST_CALL) return this.handleAnalyzeToolUse(ctx);
    if (hook !== HookPoint.PRE_PROCESS) return {};
    // Read raw req.body to bypass any ContentBlock type filtering
    const body = (ctx.req as unknown as Record<string, unknown>).body as Record<string, unknown> | undefined;
    const rawMessages = body?.messages as Array<{ role: string; content: unknown }> | undefined;
    if (!rawMessages) { this.logger.warn("vision: no messages in body"); return {}; }
    if (rawMessages.length === 0) { this.logger.warn("vision: empty messages"); return {}; }

    const messages = rawMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: (typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content) as ContentBlock[],
    }));
    const blockTypes = new Set<string>();
    for (const msg of messages) {
      if (!Array.isArray(msg.content)) { blockTypes.add("string"); continue; }
      for (const block of msg.content) blockTypes.add(((block as unknown) as Record<string, unknown>).type as string || "?");
    }
    this.logger.info({ msgCount: messages.length, blockTypes: [...blockTypes] }, "vision: scanning request");

    // 定位最后一条 user 消息（其中的图片是"新粘贴"，用用户提问做转录上下文）
    let lastUserMsgIdx = -1;
    for (let mi = messages.length - 1; mi >= 0; mi--) {
      if (messages[mi].role === "user") { lastUserMsgIdx = mi; break; }
    }

    // 扫描所有消息的图片：客户端每轮重发完整历史，历史图片同样需要转录
    // （历史图命中转录缓存，不重调视觉 API，且文本恒定以保 DeepSeek 前缀缓存）
    const imageBlocks: Array<{ msgIndex: number; blockIndex: number; source: { data: string; media_type: string } }> = [];
    for (let mi = 0; mi < messages.length; mi++) {
      const m = messages[mi];
      if (!Array.isArray(m.content)) continue;
      for (let bi = 0; bi < m.content.length; bi++) {
        const block = m.content[bi] as unknown as Record<string, unknown>;
        if (block.type === "image" && block.source) {
          const source = block.source as { data?: string; media_type?: string };
          if (source?.data && source.data.length > 100) {
            imageBlocks.push({ msgIndex: mi, blockIndex: bi, source: { data: source.data, media_type: source.media_type || "image/png" } });
          } else {
            this.logger.warn({ dataLen: source?.data?.length || 0 }, "vision: skipping image with invalid data");
          }
        }
      }
    }

    if (imageBlocks.length === 0) {
      this.logger.info("vision: no image blocks found in request");
      return {};
    }

    this.logger.info({ count: imageBlocks.length }, "vision: processing images");

    const visionCfg = getConfig().plugins.vision;

    // 按需二次识别：暂存原图（随请求释放）+ 注入 analyze_image 工具供 DeepSeek 追问
    const onDemand = visionCfg.on_demand_analysis && !!ctx.providerRequest;
    if (onDemand) {
      setVisionImages(ctx.req, imageBlocks.map((ib) => ({ data: ib.source.data, media_type: ib.source.media_type })));
      const tools = (ctx.providerRequest!.tools as Array<Record<string, unknown>> | undefined) ?? [];
      if (!tools.some((t) => t?.name === ANALYZE_IMAGE_TOOL.name)) {
        ctx.providerRequest!.tools = [...tools, ANALYZE_IMAGE_TOOL];
      }
    }

    // 上下文感知：最后一条 user 消息里的提问文字作为"新图"的转录上下文；
    // 历史图片用中性转录（且几乎必命中缓存，保持文本跨轮次恒定）
    const lastMsg = lastUserMsgIdx >= 0 ? messages[lastUserMsgIdx] : null;
    let userText: string | null = null;
    if (lastMsg && Array.isArray(lastMsg.content)) {
      userText = lastMsg.content
        .filter((b): b is { type: "text"; text: string } => (b as unknown as Record<string, unknown>).type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim() || null;
    }

    const warnings: string[] = [];
    const results = await Promise.all(
      imageBlocks.map(async (ib) => {
        const key = imageCacheKey(ib.source.data);
        const cached = transcriptionCache.get(key);
        if (cached) {
          this.logger.info({ msgIndex: ib.msgIndex }, "vision: transcription cache hit");
          return { ...ib, text: cached };
        }
        const ctxText = ib.msgIndex === lastUserMsgIdx ? userText : null;
        try {
          const text = await this.provider!.describe(ib.source.data, ib.source.media_type, buildVisionPrompt(ctxText, visionCfg.prompt));
          cacheTranscription(key, text);
          return { ...ib, text };
        } catch (err) {
          this.logger.error({ err }, "Vision API call failed");
          warnings.push(`image processing failed: ${(err as Error).message}`);
          return { ...ib, text: null };
        }
      })
    );

    // Apply results back to messages and write back to ctx for proxy router
    results.forEach((r, i) => {
      if (r.text) {
        this.logger.info({ description: r.text.slice(0, 100) }, "vision: image described");
        messages[r.msgIndex].content[r.blockIndex] = {
          type: "text",
          text: wrapDescription(r.text, i + 1, onDemand),
        };
      }
    });
    if (ctx.providerRequest) ctx.providerRequest.messages = messages;

    if (warnings.length) {
      const existing = getProxyWarnings(ctx.req) || [];
      setProxyWarnings(ctx.req, [...existing, ...warnings]);
    }

    return { modified: true };
  }

  /** POST_CALL：拦截 analyze_image tool_use → 带 DeepSeek 的分析需求二次识别 → 注入 tool_result → 重入 */
  private async handleAnalyzeToolUse(ctx: HookContext): Promise<HookResult> {
    if (!ctx.providerResponse || !ctx.providerRequest) return {};
    const images = getVisionImages(ctx.req);
    if (!images || images.length === 0) return {};

    const blocks = ctx.providerResponse.content as unknown as Array<Record<string, unknown>>;
    const analyzeUses = blocks.filter((b) => b.type === "tool_use" && b.name === ANALYZE_IMAGE_TOOL.name);
    if (analyzeUses.length === 0) return {};
    // 混合调用（同时含客户端自己的工具）不拦截，透传由客户端处理
    if (blocks.some((b) => b.type === "tool_use" && b.name !== ANALYZE_IMAGE_TOOL.name)) {
      this.logger.warn("vision: mixed tool_use (analyze_image + client tools), passing through");
      return {};
    }

    const round = ctx.visionReentryCount ?? 0;
    const exhausted = round >= MAX_ANALYSIS_ROUNDS;
    this.logger.info(
      { round, queries: analyzeUses.map((t) => (t.input as Record<string, unknown>)?.query) },
      "vision: on-demand analysis requested"
    );

    const template = getConfig().plugins.vision.prompt;
    const results = await Promise.all(
      analyzeUses.map(async (tu) => {
        const id = tu.id as string;
        if (exhausted) {
          return { id, text: "image analysis budget exhausted — answer with the information already available", isError: true };
        }
        const input = (tu.input as Record<string, unknown>) || {};
        const rawIdx = typeof input.image_index === "number" ? Math.floor(input.image_index) : 1;
        const img = images[Math.min(Math.max(1, rawIdx), images.length) - 1];
        const query = typeof input.query === "string" ? input.query : JSON.stringify(input);
        try {
          const text = await this.provider!.describe(img.data, img.media_type, buildVisionPrompt(query, template));
          this.logger.info({ query, description: text.slice(0, 100) }, "vision: on-demand analysis done");
          return { id, text, isError: false };
        } catch (err) {
          this.logger.error({ err }, "vision: on-demand analysis failed");
          return { id, text: `image analysis failed: ${(err as Error).message}`, isError: true };
        }
      })
    );

    // 追加 assistant 轮与 user(tool_result)，请求 pipeline 重入。
    // 保留 thinking 块：非连续思考场景下 DeepSeek 重入时需要看到自己此前的推理链，
    // 否则"为什么要求二次识别"的上下文断裂，可能重复推理或改变方向
    const assistantContent = ctx.providerResponse.content.filter((b) => {
      const t = (b as unknown as Record<string, unknown>).type;
      return t === "text" || t === "tool_use" || t === "thinking";
    });
    ctx.providerRequest.messages.push({ role: "assistant", content: assistantContent });
    ctx.providerRequest.messages.push({
      role: "user",
      content: results.map((r) => ({
        type: "tool_result" as const,
        tool_use_id: r.id,
        content: r.text,
        ...(r.isError ? { is_error: true } : {}),
      })) as ContentBlock[],
    });

    ctx.visionReentryCount = round + 1;
    ctx.reenter = true;
    return { modified: true };
  }
}
