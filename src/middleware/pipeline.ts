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
  getVisionImages,
  setVisionSSEReplay,
  getVisionSSEReplay,
} from "./context";
import { HookPoint, type HookContext } from "../plugins/interface";
import { replayAsSSE } from "../utils/stream";
import { ANALYZE_IMAGE_TOOL } from "../plugins/vision/prompt";

/** POST_CALL 重入循环硬上限（防插件请求无限重入） */
const MAX_REENTRY_ROUNDS = 5;

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

  // 非流式调用 + POST_CALL 重入循环（search 搜索结果重入 / vision 按需二次识别）
  async function callWithToolLoop(req: Request, providerReq: ProviderRequest, shouldAbort?: () => boolean): Promise<void> {
    let response = await provider.sendMessage(providerReq);
    setProviderResponse(req, response);
    const ctx: HookContext = { req, providerRequest: providerReq, providerResponse: response, searchReentry: false };
    for (let round = 0; round < MAX_REENTRY_ROUNDS; round++) {
      if (shouldAbort?.()) break;
      ctx.reenter = false;
      await pluginEngine.executeHook(HookPoint.POST_CALL, ctx);
      if (!ctx.reenter) break;
      response = await provider.sendMessage(providerReq);
      setProviderResponse(req, response);
      ctx.providerResponse = response;
    }

    // 兜底：analyze_image 是代理内部工具，客户端不认识——任何未被拦截的调用
    // （混合 tool_use 透传、重入上限耗尽）都必须从最终响应中剥离，避免客户端 harness 异常
    const cleaned = response.content.filter((b) => {
      const blk = b as unknown as Record<string, unknown>;
      return !(blk.type === "tool_use" && blk.name === ANALYZE_IMAGE_TOOL.name);
    });
    if (cleaned.length !== response.content.length) {
      logger.warn({ stripped: response.content.length - cleaned.length }, "pipeline: stripped leaked analyze_image tool_use from final response");
      response.content = cleaned;
      const hasToolUse = cleaned.some((b) => (b as unknown as Record<string, unknown>).type === "tool_use");
      if (response.stopReason === "tool_use" && !hasToolUse) response.stopReason = "end_turn";
      setProviderResponse(req, response);
    }
  }

  const handlers: RequestHandler[] = [
    authMiddleware,
    rateLimitMiddleware,
    modelTranslateMiddleware,
    requestTransformMiddleware,

    // Plugin pre-processing (runs before parameterFilter to see image blocks)
    ((req: Request, _res: Response, next: NextFunction) => {
      const pr = getProviderRequest(req);
      pluginEngine.executeHook(HookPoint.PRE_PROCESS, { req, providerRequest: pr })
        .then(() => next()).catch(next);
    }) as unknown as RequestHandler,

    parameterFilterMiddleware,

    // Proxy — calls LLM provider
    ((req: Request, res: Response, next: NextFunction) => {
      const providerReq = getProviderRequest(req);
      if (!providerReq) return next(new Error("No provider request"));

      if (providerReq.stream) {
        // vision 按需二次识别激活时（PRE_PROCESS 暂存了原图）无法边转发边拦截工具调用：
        // 内部改非流式跑完工具循环，最终响应经 responseTransform 后由末端中间件合成 SSE 回放。
        // 循环期间定期发 ping 事件保活，防止客户端因长时间收不到字节而超时断连
        if (getVisionImages(req)?.length) {
          setVisionSSEReplay(req, true);
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.flushHeaders?.();
          let closed = false;
          res.on("close", () => { closed = true; });
          const ping = setInterval(() => {
            if (!closed) res.write(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
          }, 15_000);
          (async () => {
            await callWithToolLoop(req, providerReq, () => closed);
            next();
          })().catch(next).finally(() => clearInterval(ping));
          return;
        }

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
        // Non-streaming — POST_CALL 插件（search/vision）可请求重入
        (async () => {
          await callWithToolLoop(req, providerReq);
          next();
        })().catch(next);
      }
    }) as unknown as RequestHandler,

    responseTransformMiddleware,

    // Send Anthropic response（vision SSE 回放场景合成流式事件，其余 JSON）
    ((req: Request, res: Response, next: NextFunction) => {
      const resp = getAnthropicResponse(req);
      if (!resp) return next();
      if (getVisionSSEReplay(req)) {
        // ping 保活可能已 flush 头部，setHeader 需跳过
        replayAsSSE(resp, {
          setHeader: (n: string, v: string) => { if (!res.headersSent) res.setHeader(n, v); },
          write: (c: string) => res.write(c),
          end: () => res.end(),
        });
      } else {
        res.json(resp);
      }
    }) as unknown as RequestHandler,
  ];

  return { handlers, errorHandler: errorHandler(logger) };
}
