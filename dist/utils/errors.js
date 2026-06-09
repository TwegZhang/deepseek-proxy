"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationError = exports.ProviderError = exports.RateLimitError = exports.AuthError = exports.ProxyError = void 0;
class ProxyError extends Error {
    statusCode;
    code;
    details;
    constructor(message, statusCode = 500, code = "PROXY_ERROR", details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = "ProxyError";
    }
    toJSON() {
        return {
            error: {
                type: this.code,
                message: this.message,
                ...(this.details ? { details: this.details } : {}),
            },
        };
    }
}
exports.ProxyError = ProxyError;
class AuthError extends ProxyError {
    constructor(message = "Invalid API key") {
        super(message, 401, "AUTH_ERROR");
        this.name = "AuthError";
    }
}
exports.AuthError = AuthError;
class RateLimitError extends ProxyError {
    constructor(message = "Rate limit exceeded") {
        super(message, 429, "RATE_LIMIT_ERROR");
        this.name = "RateLimitError";
    }
}
exports.RateLimitError = RateLimitError;
class ProviderError extends ProxyError {
    constructor(message, statusCode = 502, details) {
        super(message, statusCode, "PROVIDER_ERROR", details);
        this.name = "ProviderError";
    }
}
exports.ProviderError = ProviderError;
class ConfigurationError extends ProxyError {
    constructor(message) {
        super(message, 500, "CONFIG_ERROR");
        this.name = "ConfigurationError";
    }
}
exports.ConfigurationError = ConfigurationError;
//# sourceMappingURL=errors.js.map