import type { VisionProvider } from "./interface";
import type { Logger } from "../../utils/logger";
import { ProviderError } from "../../utils/errors";

export interface OpenAIVisionConfig {
  base_url: string;
  api_key: string;
  model: string;
  max_tokens: number;
}

export class OpenAIVisionProvider implements VisionProvider {
  readonly name: string;

  constructor(private logger: Logger, private config: OpenAIVisionConfig) {
    this.name = config.model;
  }

  async describe(imageBase64: string, mediaType: string, prompt?: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(`${this.config.base_url}/chat/completions`, {
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
              { type: "text", text: prompt || "Please describe this image in detail. Include all visible text, UI elements, objects, people, colors, layout, and any information that would be useful for understanding the image." },
              { type: "image_url", image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
            ],
          }],
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new ProviderError(`Vision API error (${res.status}): ${await res.text().catch(() => "")}`, res.status);

      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new ProviderError("Vision API returned empty response", 502);
      return text;
    } finally {
      clearTimeout(timer);
    }
  }
}
