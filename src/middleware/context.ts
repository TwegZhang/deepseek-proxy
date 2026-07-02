import type { Request } from "express";
import type { ProviderRequest, ProviderResponse } from "../models/provider";
import type { MessagesResponse } from "../models/anthropic";

const store = new WeakMap<Request, Record<string, unknown>>();

function get(req: Request): Record<string, unknown> {
  let s = store.get(req);
  if (!s) { s = {}; store.set(req, s); }
  return s;
}

export function setProviderRequest(req: Request, v: ProviderRequest): void { get(req)._providerRequest = v; }
export function getProviderRequest(req: Request): ProviderRequest | undefined { return get(req)._providerRequest as ProviderRequest | undefined; }

export function setProviderResponse(req: Request, v: ProviderResponse): void { get(req)._providerResponse = v; }
export function getProviderResponse(req: Request): ProviderResponse | undefined { return get(req)._providerResponse as ProviderResponse | undefined; }

export function setAnthropicResponse(req: Request, v: MessagesResponse): void { get(req)._anthropicResponse = v; }
export function getAnthropicResponse(req: Request): MessagesResponse | undefined { return get(req)._anthropicResponse as MessagesResponse | undefined; }

export function setOriginalModel(req: Request, model: string): void { get(req)._originalModel = model; }
export function getOriginalModel(req: Request): string | undefined { return get(req)._originalModel as string | undefined; }

export function setProxyWarnings(req: Request, warnings: string[]): void { get(req)._proxyWarnings = warnings; }
export function getProxyWarnings(req: Request): string[] | undefined { return get(req)._proxyWarnings as string[] | undefined; }

// Vision 按需二次识别：原图暂存（随请求 WeakMap 释放）+ 流式 SSE 回放标记
export interface VisionImage { data: string; media_type: string; }
export function setVisionImages(req: Request, v: VisionImage[]): void { get(req)._visionImages = v; }
export function getVisionImages(req: Request): VisionImage[] | undefined { return get(req)._visionImages as VisionImage[] | undefined; }

export function setVisionSSEReplay(req: Request, v: boolean): void { get(req)._visionSSEReplay = v; }
export function getVisionSSEReplay(req: Request): boolean { return get(req)._visionSSEReplay === true; }
