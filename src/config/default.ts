import type { Config } from "./schema";

export const defaultConfig: Config = {
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
    vision: {
      enabled: false,
      provider: "openai",
      providers: {
        openai: { base_url: "https://api.openai.com/v1", model: "gpt-4o", max_tokens: 512 },
        bailian: { base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-vl-max", max_tokens: 512 },
        volcengine: { base_url: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-vision-pro-32k", max_tokens: 512 },
        siliconflow: { base_url: "https://api.siliconflow.cn/v1", model: "Qwen/Qwen2.5-VL-72B-Instruct", max_tokens: 512 },
        minimax: { base_url: "https://api.minimax.chat/v1", model: "abab7-chat", max_tokens: 512 },
        glm: { base_url: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4v", max_tokens: 512 },
        moonshot: { base_url: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k-vision", max_tokens: 512 },
      },
    },
    search: { enabled: false, provider: "tavily" },
  },
  logging: { level: "info" },
};
