import { describe, it, expect } from "vitest";
import type { Request } from "express";
import {
  setProviderRequest, getProviderRequest,
  setProviderResponse, getProviderResponse,
  setAnthropicResponse, getAnthropicResponse,
  setOriginalModel, getOriginalModel,
  setProxyWarnings, getProxyWarnings,
} from "../../src/middleware/context";

describe("context helpers", () => {
  const req = () => ({} as Request);

  it("ProviderRequest round-trip", () => {
    const r = req(); const pr = { model: "t", messages: [], maxTokens: 10, stream: false };
    setProviderRequest(r, pr);
    expect(getProviderRequest(r)).toBe(pr);
  });

  it("ProviderResponse round-trip", () => {
    const r = req(); const pr = { id: "1", model: "m", content: [], stopReason: "end", usage: { inputTokens: 1, outputTokens: 2 } };
    setProviderResponse(r, pr);
    expect(getProviderResponse(r)).toBe(pr);
  });

  it("AnthropicResponse round-trip", () => {
    const r = req(); const ar = { id: "1", type: "message" as const, role: "assistant" as const, content: [], model: "m", stop_reason: null, usage: { input_tokens: 0, output_tokens: 0 } };
    setAnthropicResponse(r, ar);
    expect(getAnthropicResponse(r)).toBe(ar);
  });

  it("OriginalModel round-trip", () => {
    const r = req(); setOriginalModel(r, "claude-sonnet-4-20250514");
    expect(getOriginalModel(r)).toBe("claude-sonnet-4-20250514");
  });

  it("ProxyWarnings round-trip", () => {
    const r = req(); setProxyWarnings(r, ["w1"]);
    expect(getProxyWarnings(r)).toEqual(["w1"]);
  });

  it("returns undefined for unset", () => {
    const r = req();
    expect(getProviderRequest(r)).toBeUndefined();
    expect(getOriginalModel(r)).toBeUndefined();
  });

  it("isolates per request", () => {
    const r1 = req(); const r2 = req();
    setOriginalModel(r1, "a"); setOriginalModel(r2, "b");
    expect(getOriginalModel(r1)).toBe("a");
    expect(getOriginalModel(r2)).toBe("b");
  });
});
