import type { ProviderRequest, ProviderResponse, ProviderStreamChunk } from "../models/provider";
export type LLMFeature = "text" | "tool_use" | "image_input" | "streaming" | "thinking";
export interface LLMProvider {
    readonly id: string;
    readonly name: string;
    sendMessage(req: ProviderRequest): Promise<ProviderResponse>;
    sendMessageStream(req: ProviderRequest): AsyncIterable<ProviderStreamChunk>;
    supports(feature: LLMFeature): boolean;
    healthCheck(): Promise<{
        ok: boolean;
        latency: number;
    }>;
}
//# sourceMappingURL=interface.d.ts.map