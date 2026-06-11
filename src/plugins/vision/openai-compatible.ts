import type { VisionProvider } from "./interface";
import type { Logger } from "../../utils/logger";
import { ProviderError } from "../../utils/errors";
import { fetchWithTimeout } from "../../utils/fetch";

export interface OpenAIVisionConfig {
  base_url: string;
  api_key: string;
  model: string;
  max_tokens: number;
}

const DEFAULT_PROMPT = "Please describe this image in detail. Include all visible text, UI elements, objects, people, colors, layout, and any information useful for understanding the image.";

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
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt || DEFAULT_PROMPT },
              { type: "image_url", image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
            ],
          }],
        }),
      },
      30_000
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new ProviderError(`Vision API error (${res.status}): ${errBody || "no body"}`, res.status);
    }

    const data = (await res.json()) as Record<string, unknown>;
    this.logger.warn({ status: res.status, model: this.config.model, dataKeys: Object.keys(data).slice(0, 10), hasChoices: !!data?.choices }, "vision: API response");
    const choices = data?.choices as Array<{ message?: { content?: string } }> | undefined;
    const content = choices?.[0]?.message?.content;
    if (!content) throw new ProviderError(`Vision API returned empty response. status=${res.status} keys=${JSON.stringify(Object.keys(data))}`, 502);
    return content;
  }
}
