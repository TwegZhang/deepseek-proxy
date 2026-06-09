import type { Request } from "express";
import type { ProviderRequest, ProviderResponse, ProviderStreamChunk } from "../models/provider";
export declare enum HookPoint {
    PRE_PROCESS = "pre:process",
    POST_CALL = "post:call",
    PRE_STREAM_CHUNK = "pre:chunk"
}
export interface HookContext {
    req: Request;
    providerRequest?: ProviderRequest;
    providerResponse?: ProviderResponse;
    streamChunk?: ProviderStreamChunk;
    searchReentry?: boolean;
}
export interface HookResult {
    modified?: boolean;
    abort?: boolean;
    error?: string;
}
export interface Plugin {
    readonly id: string;
    readonly name: string;
    readonly hooks: HookPoint[];
    initialize(): Promise<void>;
    execute(hook: HookPoint, ctx: HookContext): Promise<HookResult>;
}
//# sourceMappingURL=interface.d.ts.map