"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parameterFilterMiddleware = parameterFilterMiddleware;
const context_1 = require("./context");
const UNSUPPORTED_PARAMS = ["top_k", "cache_control", "citations", "service_tier", "mcp_servers", "container"];
const UNSUPPORTED_CONTENT = ["image", "document", "search_result", "container_upload", "redacted_thinking"];
function parameterFilterMiddleware(req, _res, next) {
    const body = req.body;
    if (!body)
        return next();
    const warnings = [];
    for (const param of UNSUPPORTED_PARAMS) {
        if (param in body) {
            delete body[param];
            warnings.push(`${param} stripped`);
        }
    }
    if (body.thinking && typeof body.thinking === "object" && "budget_tokens" in body.thinking) {
        warnings.push("thinking.budget_tokens is ignored by upstream");
    }
    if (body.messages && Array.isArray(body.messages)) {
        for (const msg of body.messages) {
            if (Array.isArray(msg.content)) {
                msg.content = msg.content.filter((block) => {
                    if (typeof block === "object" && block !== null && typeof block.type === "string" && UNSUPPORTED_CONTENT.includes(block.type)) {
                        warnings.push(`content block "${block.type}" stripped`);
                        return false;
                    }
                    return true;
                });
            }
        }
    }
    if (warnings.length > 0)
        (0, context_1.setProxyWarnings)(req, warnings);
    next();
}
//# sourceMappingURL=parameterFilter.js.map