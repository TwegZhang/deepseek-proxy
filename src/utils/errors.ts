export class ProxyError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = "PROXY_ERROR",
    public readonly details?: unknown
  ) {
    super(message);
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

export class AuthError extends ProxyError {
  constructor(message: string = "Invalid API key") {
    super(message, 401, "AUTH_ERROR");
    this.name = "AuthError";
  }
}

export class RateLimitError extends ProxyError {
  constructor(message: string = "Rate limit exceeded") {
    super(message, 429, "RATE_LIMIT_ERROR");
    this.name = "RateLimitError";
  }
}

export class ProviderError extends ProxyError {
  constructor(message: string, statusCode: number = 502, details?: unknown) {
    super(message, statusCode, "PROVIDER_ERROR", details);
    this.name = "ProviderError";
  }
}

export class ConfigurationError extends ProxyError {
  constructor(message: string) {
    super(message, 500, "CONFIG_ERROR");
    this.name = "ConfigurationError";
  }
}
