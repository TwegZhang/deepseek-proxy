import { BaseProvider } from "../base";
import type { Logger } from "../../utils/logger";
import type { LLMFeature } from "../interface";
import type { ProviderRequest, ProviderResponse, ProviderStreamChunk } from "../../models/provider";
import type { MessagesResponse, ContentBlock } from "../../models/anthropic";
import { ProviderError } from "../../utils/errors";
import { parseSSEStream } from "../../utils/stream";
import { fetchWithTimeout } from "../../utils/fetch";

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

  private async fetchAPI(path: string, body: Record<string, unknown>): Promise<Response> {
    return fetchWithTimeout(
      `${this.baseUrl}${path}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
        body: JSON.stringify(body),
      },
      this.timeoutMs
    );
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
    const body = this.buildRequestBody(req);
    const res = await this.fetchAPI("/v1/messages", body);

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
  }

  async *sendMessageStream(req: ProviderRequest): AsyncIterable<ProviderStreamChunk> {
    const body = this.buildRequestBody(req);
    const res = await this.fetchAPI("/v1/messages", body);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new ProviderError(`DeepSeek API error (${res.status}): ${errText}`, res.status);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new ProviderError("No response body", 502);

    for await (const event of parseSSEStream(reader)) {
      const e = event as Record<string, unknown>;
      yield {
        type: e.type as string,
        index: e.index as number | undefined,
        delta: e.delta as ProviderStreamChunk["delta"],
        content_block: e.content_block as ProviderStreamChunk["content_block"],
        message: e.message as ProviderStreamChunk["message"],
        usage: e.usage ? { inputTokens: (e.usage as Record<string, number>).input_tokens, outputTokens: (e.usage as Record<string, number>).output_tokens } : undefined,
      };
    }
  }

  async healthCheck(): Promise<{ ok: boolean; latency: number }> {
    const start = Date.now();
    try {
      const res = await fetchWithTimeout(
        `${this.baseUrl}/v1/models`,
        { headers: { "x-api-key": this.apiKey } },
        this.timeoutMs
      );
      return { ok: res.ok, latency: Date.now() - start };
    } catch {
      return { ok: false, latency: Date.now() - start };
    }
  }
}
