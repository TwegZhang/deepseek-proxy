import type { Logger } from "../../utils/logger";
import type { ContentBlock } from "../../models/anthropic";
import { HookPoint, type HookContext, type HookResult, type Plugin } from "../interface";
import { OpenAIVisionProvider } from "./openai-compatible";
import { setProxyWarnings, getProxyWarnings } from "../../middleware/context";
import { getConfig } from "../../config";

export class VisionPlugin implements Plugin {
  readonly id = "vision";
  readonly name = "Image Understanding";
  readonly hooks = [HookPoint.PRE_PROCESS];

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

    this.provider = new OpenAIVisionProvider(this.logger, {
      base_url: baseUrl,
      api_key: apiKey,
      model,
      max_tokens: config.plugins.vision.max_tokens,
    });

    this.logger.info({ baseUrl, model }, "Vision plugin ready");
  }

  async execute(hook: HookPoint, ctx: HookContext): Promise<HookResult> {
    if (hook !== HookPoint.PRE_PROCESS || !this.provider) {
      this.logger.info({ hook, hasProvider: !!this.provider }, "vision: skipped");
      return {};
    }
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
    this.logger.warn({ msgCount: messages.length, blockTypes: [...blockTypes] }, "vision: block types in request");

    // Only process images from the LAST user message (most recent paste)
    let lastUserMsgIdx = -1;
    for (let mi = messages.length - 1; mi >= 0; mi--) {
      if (messages[mi].role === "user") { lastUserMsgIdx = mi; break; }
    }

    const imageBlocks: Array<{ msgIndex: number; blockIndex: number; source: { data: string; media_type: string } }> = [];
    const msg = lastUserMsgIdx >= 0 ? messages[lastUserMsgIdx] : null;
    if (msg && Array.isArray(msg.content)) {
      for (let bi = 0; bi < msg.content.length; bi++) {
        const block = msg.content[bi] as unknown as Record<string, unknown>;
        if (block.type === "image" && block.source) {
          const source = block.source as { data?: string; media_type?: string };
          if (source?.data && source.data.length > 100) {
            imageBlocks.push({ msgIndex: lastUserMsgIdx, blockIndex: bi, source: { data: source.data, media_type: source.media_type || "image/png" } });
          } else {
            this.logger.warn({ dataLen: source?.data?.length || 0 }, "vision: skipping image with invalid data");
          }
        }
      }
    }

    if (imageBlocks.length === 0) {
      this.logger.warn("vision: no image blocks found in any message");
      return {};
    }

    this.logger.info({ count: imageBlocks.length }, "vision: processing images");

    const warnings: string[] = [];
    const results = await Promise.all(
      imageBlocks.map(async (ib) => {
        try {
          return { ...ib, text: await this.provider!.describe(ib.source.data, ib.source.media_type) };
        } catch (err) {
          this.logger.error({ err }, "Vision API call failed");
          warnings.push(`image processing failed: ${(err as Error).message}`);
          return { ...ib, text: null };
        }
      })
    );

    // Apply results back to messages
    for (const r of results) {
      if (r.text) {
        this.logger.debug({ description: r.text }, "vision: image described");
        messages[r.msgIndex].content[r.blockIndex] = { type: "text", text: `[Image: ${r.text}]` };
      }
    }

    if (warnings.length) {
      const existing = getProxyWarnings(ctx.req) || [];
      setProxyWarnings(ctx.req, [...existing, ...warnings]);
    }

    return { modified: true };
  }
}
