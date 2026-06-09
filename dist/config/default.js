"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultConfig = void 0;
exports.defaultConfig = {
    server: { port: 3000, host: "0.0.0.0" },
    auth: { keys: [] },
    model_mapping: {
        "claude-opus-4-20250514": { provider: "deepseek", model: "deepseek-v4-pro" },
        "claude-sonnet-4-20250514": { provider: "deepseek", model: "deepseek-v4-flash" },
        "claude-haiku-4-5-20251001": { provider: "deepseek", model: "deepseek-v4-flash" },
        default: { provider: "deepseek", model: "deepseek-v4-flash" },
    },
    rate_limit: { enabled: true, requests_per_minute: 60, concurrency: 10 },
    providers: { deepseek: { base_url: "https://api.deepseek.com/anthropic", timeout_ms: 120000 } },
    plugins: {
        vision: { enabled: false, model: "gpt-4o", max_tokens: 512 },
        search: { enabled: false, provider: "tavily" },
    },
    logging: { level: "info" },
};
//# sourceMappingURL=default.js.map