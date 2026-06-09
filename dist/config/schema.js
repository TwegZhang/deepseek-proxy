"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigSchema = void 0;
const zod_1 = require("zod");
exports.ConfigSchema = zod_1.z.object({
    server: zod_1.z.object({
        port: zod_1.z.number().default(3000),
        host: zod_1.z.string().default("0.0.0.0"),
    }),
    auth: zod_1.z.object({
        proxy_key: zod_1.z.string().optional(),
        keys: zod_1.z
            .array(zod_1.z.object({
            label: zod_1.z.string(),
            key_hash: zod_1.z.string(),
        }))
            .default([]),
    }),
    model_mapping: zod_1.z.record(zod_1.z.string(), zod_1.z.object({
        provider: zod_1.z.string(),
        model: zod_1.z.string(),
    })),
    rate_limit: zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
        requests_per_minute: zod_1.z.number().default(60),
        concurrency: zod_1.z.number().default(10),
    }),
    providers: zod_1.z.object({
        deepseek: zod_1.z.object({
            base_url: zod_1.z.string().default("https://api.deepseek.com/anthropic"),
            api_key: zod_1.z.string().optional(),
            timeout_ms: zod_1.z.number().default(120000),
        }),
    }),
    plugins: zod_1.z.object({
        vision: zod_1.z.object({
            enabled: zod_1.z.boolean().default(false),
            model: zod_1.z.string().default("gpt-4o"),
            max_tokens: zod_1.z.number().default(512),
        }),
        search: zod_1.z.object({
            enabled: zod_1.z.boolean().default(false),
            provider: zod_1.z.enum(["tavily", "bocha", "brave"]).default("tavily"),
        }),
    }),
    logging: zod_1.z.object({
        level: zod_1.z.enum(["debug", "info", "warn", "error"]).default("info"),
    }),
});
//# sourceMappingURL=schema.js.map