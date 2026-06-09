import { describe, it, expect } from "vitest";
import { AuthError, RateLimitError, ProviderError, ConfigurationError, ProxyError } from "../../src/utils/errors";

describe("error classes", () => {
  it("AuthError is 401", () => { expect(new AuthError().statusCode).toBe(401); });
  it("RateLimitError is 429", () => { expect(new RateLimitError().statusCode).toBe(429); });
  it("ProviderError is configurable", () => { expect(new ProviderError("x", 503).statusCode).toBe(503); });
  it("ConfigurationError is 500", () => { expect(new ConfigurationError("x").statusCode).toBe(500); });
  it("ProxyError.toJSON is structured", () => {
    expect(new ProxyError("m", 400, "C").toJSON()).toEqual({ error: { type: "C", message: "m" } });
  });
});
