import type { VisionProvider } from "./interface";
import type { Logger } from "../../utils/logger";
export interface OpenAIVisionConfig {
    base_url: string;
    api_key: string;
    model: string;
    max_tokens: number;
}
export declare class OpenAIVisionProvider implements VisionProvider {
    private logger;
    private config;
    readonly name: string;
    constructor(logger: Logger, config: OpenAIVisionConfig);
    describe(imageBase64: string, mediaType: string, prompt?: string): Promise<string>;
}
//# sourceMappingURL=openai-compatible.d.ts.map