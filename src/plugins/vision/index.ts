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
    if (hook !== HookPoint.PRE_PROCESS || !this.provider) return {};
    if (!ctx.providerRequest?.messages) return {};

    const messages = ctx.providerRequest.messages;
    let modified = false;
    const warnings: string[] = [];

    for (const msg of messages) {
      if (!Array.isArray(msg.content)) continue;

      const newContent: ContentBlock[] = [];

      for (const block of msg.content) {
        if (block.type === "image") {
          const source = block.source as { data?: string; media_type?: string } | undefined;
          if (!source?.data) {
            warnings.push("image block without base64 data skipped");
            continue;
          }

          try {
            const description = await this.provider.describe(source.data, source.media_type || "image/png");
            newContent.push({ type: "text", text: `[Image: ${description}]` });
            modified = true;
          } catch (err) {
            this.logger.error({ err }, "Vision API call failed");
            warnings.push(`image processing failed: ${(err as Error).message}`);
            newContent.push(block);
          }
        } else {
          newContent.push(block);
        }
      }

      msg.content = newContent;
    }

    if (warnings.length) {
      const existing = getProxyWarnings(ctx.req) || [];
      setProxyWarnings(ctx.req, [...existing, ...warnings]);
    }

    return { modified };
  }
}
