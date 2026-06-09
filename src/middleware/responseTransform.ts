import type { Request, Response, NextFunction } from "express";
import type { MessagesResponse, ContentBlock } from "../models/anthropic";
import { reverseTranslateModel } from "./modelTranslate";
import { getProviderResponse, setAnthropicResponse, getOriginalModel, getProxyWarnings } from "./context";

export function responseTransformMiddleware(req: Request, res: Response, next: NextFunction) {
  const providerResp = getProviderResponse(req);
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

  const warnings = getProxyWarnings(req);
  if (warnings?.length) res.setHeader("X-Proxy-Warnings", warnings.join("; "));

  setAnthropicResponse(req, anthropicResp);
  next();
}
