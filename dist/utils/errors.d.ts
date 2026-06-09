export declare class ProxyError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly details?: unknown | undefined;
    constructor(message: string, statusCode?: number, code?: string, details?: unknown | undefined);
    toJSON(): {
        error: {
            details?: {} | undefined;
            type: string;
            message: string;
        };
    };
}
export declare class AuthError extends ProxyError {
    constructor(message?: string);
}
export declare class RateLimitError extends ProxyError {
    constructor(message?: string);
}
export declare class ProviderError extends ProxyError {
    constructor(message: string, statusCode?: number, details?: unknown);
}
export declare class ConfigurationError extends ProxyError {
    constructor(message: string);
}
//# sourceMappingURL=errors.d.ts.map