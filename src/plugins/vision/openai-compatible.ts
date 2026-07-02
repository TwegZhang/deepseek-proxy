import type { VisionProvider } from "./interface";
import type { Logger } from "../../utils/logger";
import { ProviderError } from "../../utils/errors";
import { fetchWithTimeout } from "../../utils/fetch";
import { FALLBACK_PROMPT } from "./prompt";

export interface OpenAIVisionConfig {
  base_url: string;
  api_key: string;
  model: string;
  max_tokens: number;
  /** thinking 模型（Qwen/DeepSeek 等）的推理 token 上限；不设则不随请求发送 */
  thinking_budget?: number;
}

export class OpenAIVisionProvider implements VisionProvider {
  readonly name: string;

  constructor(private logger: Logger, private config: OpenAIVisionConfig) {
    this.name = config.model;
  }

  async describe(imageBase64: string, mediaType: string, prompt?: string): Promise<string> {
    const res = await fetchWithTimeout(
      `${this.config.base_url}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.api_key}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.max_tokens,
          ...(this.config.thinking_budget ? { thinking_budget: this.config.thinking_budget } : {}),
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt || FALLBACK_PROMPT },
              { type: "image_url", image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
            ],
          }],
        }),
      },
      120_000
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new ProviderError(`Vision API error (${res.status}): ${errBody || "no body"}`, res.status);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const choices = data?.choices as Array<Record<string, unknown>> | undefined;
    const firstChoice = choices?.[0];
    this.logger.debug({
      status: res.status, model: this.config.model,
      choiceKeys: firstChoice ? Object.keys(firstChoice) : [],
      hasMessage: !!firstChoice?.message,
      msgKeys: firstChoice?.message ? Object.keys(firstChoice.message as Record<string, unknown>) : [],
    }, "vision: API response");
    const msg = firstChoice?.message as Record<string, unknown> | undefined;
    const content = (msg?.content || msg?.reasoning_content) as string | undefined;
    if (!content) throw new ProviderError(`Vision API returned empty content. content='${msg?.content}' reasoning='${String(msg?.reasoning_content).slice(0,50)}'`, 502);
    return content;
  }
}
