"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIVisionProvider = void 0;
const errors_1 = require("../../utils/errors");
const fetch_1 = require("../../utils/fetch");
const DEFAULT_PROMPT = "Please describe this image in detail. Include all visible text, UI elements, objects, people, colors, layout, and any information useful for understanding the image.";
class OpenAIVisionProvider {
    logger;
    config;
    name;
    constructor(logger, config) {
        this.logger = logger;
        this.config = config;
        this.name = config.model;
    }
    async describe(imageBase64, mediaType, prompt) {
        const res = await (0, fetch_1.fetchWithTimeout)(`${this.config.base_url}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.config.api_key}`,
            },
            body: JSON.stringify({
                model: this.config.model,
                max_tokens: this.config.max_tokens,
                messages: [{
                        role: "user",
                        content: [
                            { type: "text", text: prompt || DEFAULT_PROMPT },
                            { type: "image_url", image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
                        ],
                    }],
            }),
        }, 30_000);
        if (!res.ok) {
            const errBody = await res.text();
            throw new errors_1.ProviderError(`Vision API error (${res.status}): ${errBody || "no body"}`, res.status);
        }
        const data = (await res.json());
        const choices = data?.choices;
        const content = choices?.[0]?.message?.content;
        if (!content)
            throw new errors_1.ProviderError("Vision API returned empty response", 502);
        return content;
    }
}
exports.OpenAIVisionProvider = OpenAIVisionProvider;
//# sourceMappingURL=openai-compatible.js.map