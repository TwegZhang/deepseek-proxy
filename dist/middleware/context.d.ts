import type { Request } from "express";
import type { ProviderRequest, ProviderResponse } from "../models/provider";
import type { MessagesResponse } from "../models/anthropic";
export declare function setProviderRequest(req: Request, v: ProviderRequest): void;
export declare function getProviderRequest(req: Request): ProviderRequest | undefined;
export declare function setProviderResponse(req: Request, v: ProviderResponse): void;
export declare function getProviderResponse(req: Request): ProviderResponse | undefined;
export declare function setAnthropicResponse(req: Request, v: MessagesResponse): void;
export declare function getAnthropicResponse(req: Request): MessagesResponse | undefined;
export declare function setOriginalModel(req: Request, model: string): void;
export declare function getOriginalModel(req: Request): string | undefined;
export declare function setProxyWarnings(req: Request, warnings: string[]): void;
export declare function getProxyWarnings(req: Request): string[] | undefined;
//# sourceMappingURL=context.d.ts.map