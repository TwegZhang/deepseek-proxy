import type { Logger } from "../../utils/logger";
import type { LLMProvider, LLMFeature } from "../interface";
import type { ProviderRequest, ProviderResponse, ProviderStreamChunk } from "../../models/provider";
export declare class DeepSeekProvider implements LLMProvider {
    private logger;
    readonly id = "deepseek";
    readonly name = "DeepSeek";
    private _features;
    private baseUrl;
    private apiKey;
    private timeoutMs;
    constructor(logger: Logger, config: {
        base_url: string;
        api_key: string;
        timeout_ms: number;
    });
    supports(feature: LLMFeature): boolean;
    private fetchAPI;
    private buildRequestBody;
    sendMessage(req: ProviderRequest): Promise<ProviderResponse>;
    sendMessageStream(req: ProviderRequest): AsyncIterable<ProviderStreamChunk>;
    healthCheck(): Promise<{
        ok: boolean;
        latency: number;
    }>;
}
//# sourceMappingURL=index.d.ts.map