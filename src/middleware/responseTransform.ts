import type { Request, Response, NextFunction } from "express";
import type { ProviderResponse } from "../models/provider";
import type { MessagesResponse, ContentBlock } from "../models/anthropic";
import { reverseTranslateModel, getOriginalModel } from "./modelTranslate";

export function responseTransformMiddleware(req: Request, res: Response, next: NextFunction) {
  const providerResp = (req as unknown as Record<string, unknown>)._providerResponse as ProviderResponse | undefined;
  if (!providerResp) return next();

  const originalModel = getOriginalModel(req);

  const anthropicResp: MessagesResponse = {
    id: providerResp.id,
    type: "message",
    role: "assistant",
    content: providerResp.content as ContentBlock[],
    model: originalModel || reverseTranslateModel(providerResp.model),
    stop_reason: (providerResp.stopReason as MessagesResponse["stop_reason"]) || null,
    usage: {
      input_tokens: providerResp.usage.inputTokens,
      output_tokens: providerResp.usage.outputTokens,
    },
  };

  const warnings = (req as unknown as Record<string, unknown>)._proxyWarnings as string[] | undefined;
  if (warnings?.length) res.setHeader("X-Proxy-Warnings", warnings.join("; "));

  (req as unknown as Record<string, unknown>)._anthropicResponse = anthropicResp;
  next();
}

export function getAnthropicResponse(req: Request): MessagesResponse | undefined {
  return (req as unknown as Record<string, unknown>)._anthropicResponse as MessagesResponse | undefined;
}
