"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.responseTransformMiddleware = responseTransformMiddleware;
const modelTranslate_1 = require("./modelTranslate");
const context_1 = require("./context");
function responseTransformMiddleware(req, res, next) {
    const providerResp = (0, context_1.getProviderResponse)(req);
    if (!providerResp)
        return next();
    const originalModel = (0, context_1.getOriginalModel)(req);
    const anthropicResp = {
        id: providerResp.id,
        type: "message",
        role: "assistant",
        content: providerResp.content,
        model: originalModel || (0, modelTranslate_1.reverseTranslateModel)(providerResp.model),
        stop_reason: providerResp.stopReason || null,
        usage: {
            input_tokens: providerResp.usage.inputTokens,
            output_tokens: providerResp.usage.outputTokens,
        },
    };
    const warnings = (0, context_1.getProxyWarnings)(req);
    if (warnings?.length)
        res.setHeader("X-Proxy-Warnings", warnings.join("; "));
    (0, context_1.setAnthropicResponse)(req, anthropicResp);
    next();
}
//# sourceMappingURL=responseTransform.js.map