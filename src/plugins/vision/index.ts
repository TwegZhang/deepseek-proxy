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
    const config = getConfig();
    const vc = config.plugins.vision;

    const providerConfig = vc.providers[vc.provider];
    if (!providerConfig) {
      this.logger.warn({ provider: vc.provider }, "Vision provider not found in config — disabled");
      return;
    }

    const envKey = `DP_VISION_${vc.provider.toUpperCase()}_API_KEY`;
    const apiKey = providerConfig.api_key || process.env[envKey];
    if (!apiKey) {
      this.logger.warn({ envKey }, `Vision API key not set — disabled. Set ${envKey} env var.`);
      return;
    }

    this.provider = new OpenAIVisionProvider(this.logger, {
      base_url: providerConfig.base_url,
      api_key: apiKey,
      model: providerConfig.model,
      max_tokens: providerConfig.max_tokens,
    });

    this.logger.info({ provider: vc.provider, model: providerConfig.model }, "Vision plugin ready");
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
            newContent.push(block); // keep original on failure
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
