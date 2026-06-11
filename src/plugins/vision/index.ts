import type { Logger } from "../../utils/logger";
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
    if (hook !== HookPoint.PRE_PROCESS || !this.provider) return {};
    if (!ctx.providerRequest?.messages) return {};

    const messages = ctx.providerRequest.messages;

    // Log image blocks found during scan
    for (const msg of messages) {
      if (!Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        const b = block as unknown as Record<string, unknown>;
        if (b.type === "image" && b.source) {
          const src = b.source as Record<string, unknown>;
          this.logger.info({ sourceType: src.type, hasData: !!src.data, dataLen: typeof src.data === "string" ? src.data.length : 0, hasUrl: !!src.url, url: src.url }, "vision: found image block");
        }
      }
    }

    const imageBlocks: Array<{ msgIndex: number; blockIndex: number; source: { data: string; media_type: string } }> = [];
    for (let mi = 0; mi < messages.length; mi++) {
      const msg = messages[mi];
      if (!Array.isArray(msg.content)) continue;
      for (let bi = 0; bi < msg.content.length; bi++) {
        const block = msg.content[bi] as unknown as Record<string, unknown>;
        if (block.type === "image" && block.source) {
          const source = block.source as { data?: string; media_type?: string };
          if (source?.data) {
            imageBlocks.push({ msgIndex: mi, blockIndex: bi, source: { data: source.data, media_type: source.media_type || "image/png" } });
          }
        } else if (block.type === "image_url" && block.image_url) {
          const imageUrl = (block.image_url as { url?: string }).url || "";
          const match = imageUrl.match(/^data:(image\/[\w+-]+);base64,(.+)$/);
          if (match) {
            imageBlocks.push({ msgIndex: mi, blockIndex: bi, source: { data: match[2], media_type: match[1] } });
          }
        }
      }
    }

    if (imageBlocks.length === 0) {
      this.logger.debug("vision: no image blocks found");
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
