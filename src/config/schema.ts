import { z } from "zod";

export const ConfigSchema = z.object({
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default("0.0.0.0"),
  }),

  auth: z.object({
    proxy_key: z.string().optional(),
    keys: z
      .array(
        z.object({
          label: z.string(),
          key_hash: z.string(),
        })
      )
      .default([]),
  }),

  model_mapping: z.record(
    z.string(),
    z.object({
      provider: z.string(),
      model: z.string(),
    })
  ),

  rate_limit: z.object({
    enabled: z.boolean().default(true),
    requests_per_minute: z.number().default(60),
    concurrency: z.number().default(10),
  }),

  providers: z.object({
    deepseek: z.object({
      base_url: z.string().default("https://api.deepseek.com/anthropic"),
      api_key: z.string().optional(),
      timeout_ms: z.number().default(120000),
    }),
  }),

  plugins: z.object({
    vision: z.object({
      enabled: z.boolean().default(false),
      model: z.string().default("gpt-4o"),
      max_tokens: z.number().default(512),
    }),
    search: z.object({
      enabled: z.boolean().default(false),
      provider: z.enum(["tavily", "bocha", "brave"]).default("tavily"),
    }),
  }),

  logging: z.object({
    level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;
