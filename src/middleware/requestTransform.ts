import type { Request, Response, NextFunction } from "express";
import type { ProviderRequest, InternalMessage } from "../models/provider";
import type { MessagesRequest, ContentBlock, Message } from "../models/anthropic";

export function requestTransformMiddleware(req: Request, _res: Response, next: NextFunction) {
  const body = req.body as MessagesRequest;
  if (!body?.messages) return next();

  const messages: InternalMessage[] = body.messages.map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? [{ type: "text" as const, text: m.content }] : (m.content as ContentBlock[]),
  }));

  let system: string | undefined;
  if (body.system) {
    system = typeof body.system === "string" ? body.system : body.system.map((s) => s.text).join("\n");
  }

  const providerReq: ProviderRequest = {
    model: body.model,
    messages,
    system,
    maxTokens: body.max_tokens || 4096,
    temperature: body.temperature,
    topP: body.top_p,
    stopSequences: body.stop_sequences,
    stream: body.stream || false,
    tools: body.tools as unknown[],
    thinking: body.thinking,
    metadata: body.metadata,
  };

  (req as unknown as Record<string, unknown>)._providerRequest = providerReq;
  next();
}

export function getProviderRequest(req: Request): ProviderRequest | undefined {
  return (req as unknown as Record<string, unknown>)._providerRequest as ProviderRequest | undefined;
}
