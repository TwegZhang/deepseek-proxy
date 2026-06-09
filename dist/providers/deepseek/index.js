"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepSeekProvider = void 0;
const errors_1 = require("../../utils/errors");
const stream_1 = require("../../utils/stream");
const fetch_1 = require("../../utils/fetch");
class DeepSeekProvider {
    logger;
    id = "deepseek";
    name = "DeepSeek";
    _features = new Set(["text", "tool_use", "streaming", "thinking"]);
    baseUrl;
    apiKey;
    timeoutMs;
    constructor(logger, config) {
        this.logger = logger;
        this.baseUrl = config.base_url;
        this.apiKey = config.api_key;
        this.timeoutMs = config.timeout_ms;
    }
    supports(feature) {
        return this._features.has(feature);
    }
    async fetchAPI(path, body) {
        return (0, fetch_1.fetchWithTimeout)(`${this.baseUrl}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
            body: JSON.stringify(body),
        }, this.timeoutMs);
    }
    buildRequestBody(req) {
        const body = {
            model: req.model,
            max_tokens: req.maxTokens,
            messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        };
        if (req.system)
            body.system = req.system;
        if (req.temperature !== undefined)
            body.temperature = req.temperature;
        if (req.topP !== undefined)
            body.top_p = req.topP;
        if (req.stopSequences)
            body.stop_sequences = req.stopSequences;
        if (req.tools)
            body.tools = req.tools;
        if (req.thinking)
            body.thinking = req.thinking;
        return body;
    }
    async sendMessage(req) {
        const body = this.buildRequestBody(req);
        const res = await this.fetchAPI("/v1/messages", body);
        if (!res.ok) {
            const errText = await res.text().catch(() => "");
            throw new errors_1.ProviderError(`DeepSeek API error (${res.status}): ${errText}`, res.status);
        }
        const data = (await res.json());
        return {
            id: data.id,
            model: data.model,
            content: data.content,
            stopReason: data.stop_reason,
            usage: { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens },
        };
    }
    async *sendMessageStream(req) {
        const body = this.buildRequestBody(req);
        const res = await this.fetchAPI("/v1/messages", body);
        if (!res.ok) {
            const errText = await res.text().catch(() => "");
            throw new errors_1.ProviderError(`DeepSeek API error (${res.status}): ${errText}`, res.status);
        }
        const reader = res.body?.getReader();
        if (!reader)
            throw new errors_1.ProviderError("No response body", 502);
        for await (const event of (0, stream_1.parseSSEStream)(reader)) {
            const e = event;
            yield {
                type: e.type,
                index: e.index,
                delta: e.delta,
                content_block: e.content_block,
                message: e.message,
                usage: e.usage ? { inputTokens: e.usage.input_tokens, outputTokens: e.usage.output_tokens } : undefined,
            };
        }
    }
    async healthCheck() {
        const start = Date.now();
        try {
            const res = await (0, fetch_1.fetchWithTimeout)(`${this.baseUrl}/v1/models`, { headers: { "x-api-key": this.apiKey } }, this.timeoutMs);
            return { ok: res.ok, latency: Date.now() - start };
        }
        catch {
            return { ok: false, latency: Date.now() - start };
        }
    }
}
exports.DeepSeekProvider = DeepSeekProvider;
//# sourceMappingURL=index.js.map