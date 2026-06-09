import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { Config } from "../config/schema";
import type { Logger } from "../utils/logger";
import type { PluginEngine } from "../plugins/engine";
import type { LLMProvider } from "../providers/interface";
import type { ProviderRequest } from "../models/provider";
import { authMiddleware } from "./auth";
import { rateLimitMiddleware } from "./rateLimit";
import { parameterFilterMiddleware } from "./parameterFilter";
import { modelTranslateMiddleware } from "./modelTranslate";
import { requestTransformMiddleware } from "./requestTransform";
import { responseTransformMiddleware } from "./responseTransform";
import { errorHandler } from "./errorHandler";
import {
  getProviderRequest,
  setProviderResponse,
  getAnthropicResponse,
} from "./context";
import { HookPoint } from "../plugins/interface";

type ErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => void;

export interface PipelineDeps {
  config: Config;
  logger: Logger;
  pluginEngine: PluginEngine;
  provider: LLMProvider;
}

export function buildMiddlewareStack(deps: PipelineDeps): {
  handlers: RequestHandler[];
  errorHandler: ErrorHandler;
} {
  const { logger, pluginEngine, provider } = deps;

  const handlers: RequestHandler[] = [
    authMiddleware,
    rateLimitMiddleware,
    parameterFilterMiddleware,
    modelTranslateMiddleware,
    requestTransformMiddleware,

    // Plugin pre-processing
    ((req: Request, _res: Response, next: NextFunction) => {
      const pr = getProviderRequest(req);
      pluginEngine.executeHook(HookPoint.PRE_PROCESS, { req, providerRequest: pr })
        .then(() => next()).catch(next);
    }) as unknown as RequestHandler,

    // Proxy — calls LLM provider
    ((req: Request, res: Response, next: NextFunction) => {
      const providerReq = getProviderRequest(req);
      if (!providerReq) return next(new Error("No provider request"));

      if (providerReq.stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        let lastModel: string | undefined;
        let aborted = false;
        res.on("close", () => { aborted = true; });

        (async () => {
          try {
            for await (const chunk of provider.sendMessageStream(providerReq)) {
              if (aborted) break;
              await pluginEngine.executeHook(HookPoint.PRE_STREAM_CHUNK, {
                req, providerRequest: providerReq, streamChunk: chunk,
              });
              if (chunk.message?.model) lastModel = chunk.message.model;
              res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }
            if (lastModel) {
              await pluginEngine.executeHook(HookPoint.POST_CALL, {
                req, providerRequest: providerReq,
                providerResponse: { id: "stream", model: lastModel, content: [], stopReason: null, usage: { inputTokens: 0, outputTokens: 0 } },
              });
            }
            res.write("data: [DONE]\n\n");
            res.end();
          } catch (err) { next(err); }
        })();
      } else {
        provider.sendMessage(providerReq).then((response) => {
          setProviderResponse(req, response);
          return pluginEngine.executeHook(HookPoint.POST_CALL, { req, providerRequest: providerReq, providerResponse: response });
        }).then(() => next()).catch(next);
      }
    }) as unknown as RequestHandler,

    responseTransformMiddleware,

    // Send Anthropic response
    ((req: Request, res: Response, next: NextFunction) => {
      const resp = getAnthropicResponse(req);
      if (resp) res.json(resp);
      else next();
    }) as unknown as RequestHandler,
  ];

  return { handlers, errorHandler: errorHandler(logger) };
}
