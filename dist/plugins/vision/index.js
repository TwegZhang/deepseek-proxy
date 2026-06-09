"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisionPlugin = void 0;
const interface_1 = require("../interface");
const openai_compatible_1 = require("./openai-compatible");
const context_1 = require("../../middleware/context");
const config_1 = require("../../config");
class VisionPlugin {
    logger;
    id = "vision";
    name = "Image Understanding";
    hooks = [interface_1.HookPoint.PRE_PROCESS];
    provider = null;
    constructor(logger) {
        this.logger = logger;
    }
    async initialize() {
        const baseUrl = process.env.DP_VISION_BASE_URL;
        const apiKey = process.env.DP_VISION_API_KEY;
        if (!baseUrl || !apiKey) {
            this.logger.warn("Vision plugin disabled — set DP_VISION_BASE_URL and DP_VISION_API_KEY in .env");
            return;
        }
        const config = (0, config_1.getConfig)();
        const model = process.env.DP_VISION_MODEL || config.plugins.vision.model;
        this.provider = new openai_compatible_1.OpenAIVisionProvider(this.logger, {
            base_url: baseUrl,
            api_key: apiKey,
            model,
            max_tokens: config.plugins.vision.max_tokens,
        });
        this.logger.info({ baseUrl, model }, "Vision plugin ready");
    }
    async execute(hook, ctx) {
        if (hook !== interface_1.HookPoint.PRE_PROCESS || !this.provider)
            return {};
        if (!ctx.providerRequest?.messages)
            return {};
        const messages = ctx.providerRequest.messages;
        // Collect all image blocks across messages for parallel processing
        const imageBlocks = [];
        for (let mi = 0; mi < messages.length; mi++) {
            const msg = messages[mi];
            if (!Array.isArray(msg.content))
                continue;
            for (let bi = 0; bi < msg.content.length; bi++) {
                const block = msg.content[bi];
                if (block.type === "image") {
                    const source = block.source;
                    if (source?.data) {
                        imageBlocks.push({ msgIndex: mi, blockIndex: bi, source: { data: source.data, media_type: source.media_type || "image/png" } });
                    }
                }
            }
        }
        if (imageBlocks.length === 0)
            return {};
        const warnings = [];
        const results = await Promise.all(imageBlocks.map(async (ib) => {
            try {
                return { ...ib, text: await this.provider.describe(ib.source.data, ib.source.media_type) };
            }
            catch (err) {
                this.logger.error({ err }, "Vision API call failed");
                warnings.push(`image processing failed: ${err.message}`);
                return { ...ib, text: null };
            }
        }));
        // Apply results back to messages
        for (const r of results) {
            if (r.text) {
                messages[r.msgIndex].content[r.blockIndex] = { type: "text", text: `[Image: ${r.text}]` };
            }
        }
        if (warnings.length) {
            const existing = (0, context_1.getProxyWarnings)(ctx.req) || [];
            (0, context_1.setProxyWarnings)(ctx.req, [...existing, ...warnings]);
        }
        return { modified: true };
    }
}
exports.VisionPlugin = VisionPlugin;
//# sourceMappingURL=index.js.map