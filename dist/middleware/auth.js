"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const config_1 = require("../config");
const errors_1 = require("../utils/errors");
function authMiddleware(req, _res, next) {
    const config = (0, config_1.getConfig)();
    const proxyKey = config.auth.proxy_key;
    const keys = config.auth.keys;
    if (!proxyKey && keys.length === 0)
        return next();
    const apiKey = req.headers["x-api-key"]?.trim();
    if (!apiKey)
        return next(new errors_1.AuthError("Missing x-api-key header"));
    // Single-key mode — simple string compare, no bcrypt needed
    if (proxyKey) {
        if (apiKey === proxyKey)
            return next();
        return next(new errors_1.AuthError("Invalid API key"));
    }
    // Multi-key mode — async bcrypt compare
    Promise.all(keys.map((k) => bcryptjs_1.default.compare(apiKey, k.key_hash)))
        .then((results) => {
        if (results.some(Boolean))
            return next();
        next(new errors_1.AuthError("Invalid API key"));
    })
        .catch(next);
}
//# sourceMappingURL=auth.js.map