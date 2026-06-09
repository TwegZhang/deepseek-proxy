"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestTransformMiddleware = requestTransformMiddleware;
const context_1 = require("./context");
function requestTransformMiddleware(req, _res, next) {
    const body = req.body;
    if (!body?.messages)
        return next();
    const messages = body.messages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content,
    }));
    let system;
    if (body.system) {
        system = typeof body.system === "string" ? body.system : body.system.map((s) => s.text).join("\n");
    }
    const providerReq = {
        model: body.model, messages, system,
        maxTokens: body.max_tokens || 4096,
        temperature: body.temperature,
        topP: body.top_p,
        stopSequences: body.stop_sequences,
        stream: body.stream || false,
        tools: body.tools,
        thinking: body.thinking,
        metadata: body.metadata,
    };
    (0, context_1.setProviderRequest)(req, providerReq);
    next();
}
//# sourceMappingURL=requestTransform.js.map