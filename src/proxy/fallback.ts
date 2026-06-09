import type { Logger } from "../utils/logger";
import type { LLMProvider } from "../providers/interface";
import type { ProviderRequest, ProviderResponse } from "../models/provider";
import { ProviderError } from "../utils/errors";

export interface FallbackStep {
  provider: LLMProvider;
  model: string;
}

export class FallbackChain {
  constructor(private logger: Logger, private steps: FallbackStep[]) {}

  async execute(req: ProviderRequest): Promise<ProviderResponse> {
    let lastError: Error | null = null;

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      try {
        this.logger.info({ provider: step.provider.id, model: step.model, attempt: i + 1 }, "Calling");
        return await step.provider.sendMessage({ ...req, model: step.model });
      } catch (err) {
        lastError = err as Error;
        this.logger.warn({ err: lastError, provider: step.provider.id, attempt: i + 1 }, "Failed, trying next");
      }
    }

    throw new ProviderError(`All ${this.steps.length} providers failed`, 502, "ALL_PROVIDERS_FAILED");
  }
}
