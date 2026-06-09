import { BaseProvider } from "../base";
import type { Logger } from "../../utils/logger";
import type { LLMFeature } from "../interface";
import type { ProviderRequest, ProviderResponse, ProviderStreamChunk } from "../../models/provider";
import type { MessagesResponse, ContentBlock } from "../../models/anthropic";
import { ProviderError } from "../../utils/errors";

export class DeepSeekProvider extends BaseProvider {
  readonly id = "deepseek";
  readonly name = "DeepSeek";
  protected _features: Set<LLMFeature> = new Set(["text", "tool_use", "streaming", "thinking"]);

  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor(logger: Logger, config: { base_url: string; api_key: string; timeout_ms: number }) {
    super(logger);
    this.baseUrl = config.base_url;
    this.apiKey = config.api_key;
    this.timeoutMs = config.timeout_ms;
  }

  private buildRequestBody(req: ProviderRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    };
    if (req.system) body.system = req.system;
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.topP !== undefined) body.top_p = req.topP;
    if (req.stopSequences) body.stop_sequences = req.stopSequences;
    if (req.tools) body.tools = req.tools;
    if (req.thinking) body.thinking = req.thinking;
    return body;
  }

  async sendMessage(req: ProviderRequest): Promise<ProviderResponse> {
    const body = this.buildRequestBody({ ...req, stream: false });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new ProviderError(`DeepSeek API error (${res.status}): ${errText}`, res.status);
      }

      const data = (await res.json()) as MessagesResponse;
      return {
        id: data.id,
        model: data.model,
        content: data.content as ContentBlock[],
        stopReason: data.stop_reason,
        usage: { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async *sendMessageStream(req: ProviderRequest): AsyncIterable<ProviderStreamChunk> {
    const body = this.buildRequestBody({ ...req, stream: true });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new ProviderError(`DeepSeek API error (${res.status}): ${errText}`, res.status);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new ProviderError("No response body", 502);

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") return;
          try {
            const event = JSON.parse(jsonStr);
            yield {
              type: event.type,
              index: event.index,
              delta: event.delta,
              content_block: event.content_block,
              message: event.message,
              usage: event.usage
                ? { inputTokens: event.usage.input_tokens, outputTokens: event.usage.output_tokens }
                : undefined,
            };
          } catch {
            // skip unparseable chunks
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<{ ok: boolean; latency: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        headers: { "x-api-key": this.apiKey },
      });
      return { ok: res.ok, latency: Date.now() - start };
    } catch {
      return { ok: false, latency: Date.now() - start };
    }
  }
}
