import type { Request } from "express";
import type { ProviderRequest, ProviderResponse, ProviderStreamChunk } from "../models/provider";

export enum HookPoint {
  PRE_PROCESS = "pre:process",
  POST_CALL = "post:call",
  PRE_STREAM_CHUNK = "pre:chunk",
}

export interface HookContext {
  req: Request;
  providerRequest?: ProviderRequest;
  providerResponse?: ProviderResponse;
  streamChunk?: ProviderStreamChunk;
  searchReentry?: boolean;
  /** POST_CALL 插件置 true 请求 pipeline 重入供应商（每轮循环前由 pipeline 重置） */
  reenter?: boolean;
  /** vision 按需二次识别已进行的轮数（上限见 vision 插件） */
  visionReentryCount?: number;
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
