import type { Logger } from "../utils/logger";
import type { LLMProvider, LLMFeature } from "./interface";
import type { ProviderRequest, ProviderResponse, ProviderStreamChunk } from "../models/provider";

export abstract class BaseProvider implements LLMProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  protected abstract _features: Set<LLMFeature>;

  constructor(protected logger: Logger) {}

  abstract sendMessage(req: ProviderRequest): Promise<ProviderResponse>;
  abstract sendMessageStream(req: ProviderRequest): AsyncIterable<ProviderStreamChunk>;
  abstract healthCheck(): Promise<{ ok: boolean; latency: number }>;

  supports(feature: LLMFeature): boolean {
    return this._features.has(feature);
  }
}
