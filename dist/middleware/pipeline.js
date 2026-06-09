"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMiddlewareStack = buildMiddlewareStack;
const auth_1 = require("./auth");
const rateLimit_1 = require("./rateLimit");
const parameterFilter_1 = require("./parameterFilter");
const modelTranslate_1 = require("./modelTranslate");
const requestTransform_1 = require("./requestTransform");
const responseTransform_1 = require("./responseTransform");
const errorHandler_1 = require("./errorHandler");
const context_1 = require("./context");
const interface_1 = require("../plugins/interface");
function buildMiddlewareStack(deps) {
    const { logger, pluginEngine, provider } = deps;
    const handlers = [
        auth_1.authMiddleware,
        rateLimit_1.rateLimitMiddleware,
        parameterFilter_1.parameterFilterMiddleware,
        modelTranslate_1.modelTranslateMiddleware,
        requestTransform_1.requestTransformMiddleware,
        // Plugin pre-processing
        ((req, _res, next) => {
            const pr = (0, context_1.getProviderRequest)(req);
            pluginEngine.executeHook(interface_1.HookPoint.PRE_PROCESS, { req, providerRequest: pr })
                .then(() => next()).catch(next);
        }),
        // Proxy — calls LLM provider
        ((req, res, next) => {
            const providerReq = (0, context_1.getProviderRequest)(req);
            if (!providerReq)
                return next(new Error("No provider request"));
            if (providerReq.stream) {
                res.setHeader("Content-Type", "text/event-stream");
                res.setHeader("Cache-Control", "no-cache");
                res.setHeader("Connection", "keep-alive");
                let lastModel;
                let aborted = false;
                res.on("close", () => { aborted = true; });
                (async () => {
                    try {
                        for await (const chunk of provider.sendMessageStream(providerReq)) {
                            if (aborted)
                                break;
                            await pluginEngine.executeHook(interface_1.HookPoint.PRE_STREAM_CHUNK, {
                                req, providerRequest: providerReq, streamChunk: chunk,
                            });
                            if (chunk.message?.model)
                                lastModel = chunk.message.model;
                            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                        }
                        if (lastModel) {
                            await pluginEngine.executeHook(interface_1.HookPoint.POST_CALL, {
                                req, providerRequest: providerReq,
                                providerResponse: { id: "stream", model: lastModel, content: [], stopReason: null, usage: { inputTokens: 0, outputTokens: 0 } },
                            });
                        }
                        res.write("data: [DONE]\n\n");
                        res.end();
                    }
                    catch (err) {
                        next(err);
                    }
                })();
            }
            else {
                // Non-streaming — may re-enter for search
                (async () => {
                    let response = await provider.sendMessage(providerReq);
                    (0, context_1.setProviderResponse)(req, response);
                    const ctx = { req, providerRequest: providerReq, providerResponse: response, searchReentry: false };
                    await pluginEngine.executeHook(interface_1.HookPoint.POST_CALL, ctx);
                    // Search plugin may have modified messages — re-call provider with results
                    if (ctx.searchReentry) {
                        response = await provider.sendMessage(providerReq);
                        (0, context_1.setProviderResponse)(req, response);
                        await pluginEngine.executeHook(interface_1.HookPoint.POST_CALL, { req, providerRequest: providerReq, providerResponse: response, searchReentry: true });
                    }
                    next();
                })().catch(next);
            }
        }),
        responseTransform_1.responseTransformMiddleware,
        // Send Anthropic response
        ((req, res, next) => {
            const resp = (0, context_1.getAnthropicResponse)(req);
            if (resp)
                res.json(resp);
            else
                next();
        }),
    ];
    return { handlers, errorHandler: (0, errorHandler_1.errorHandler)(logger) };
}
//# sourceMappingURL=pipeline.js.map