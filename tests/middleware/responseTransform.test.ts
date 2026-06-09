import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { responseTransformMiddleware } from "../../src/middleware/responseTransform";
import { setProviderResponse, setOriginalModel, getAnthropicResponse, setProxyWarnings } from "../../src/middleware/context";

vi.mock("../../src/config", () => ({
  getConfig: () => ({
    model_mapping: {
      "claude-sonnet-4-20250514": { provider: "deepseek", model: "deepseek-v4-flash" },
      default: { provider: "deepseek", model: "deepseek-v4-flash" },
    },
  }),
}));

describe("responseTransformMiddleware", () => {
  it("reverse-translates model and converts to Anthropic format", () => {
    const req = { body: {} } as Request;
    const res = { setHeader: vi.fn() } as unknown as Response;
    const next = vi.fn();

    setOriginalModel(req, "claude-sonnet-4-20250514");
    setProviderResponse(req, {
      id: "msg_123", model: "deepseek-v4-flash",
      content: [{ type: "text", text: "Hello" }],
      stopReason: "end_turn",
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    responseTransformMiddleware(req, res, next);

    const ar = getAnthropicResponse(req);
    expect(ar).toBeDefined();
    expect(ar!.model).toBe("claude-sonnet-4-20250514");
    expect(ar!.type).toBe("message");
    expect(ar!.usage.input_tokens).toBe(10);
  });

  it("sets proxy warnings header", () => {
    const req = { body: {} } as Request;
    const res = { setHeader: vi.fn() } as unknown as Response;
    const next = vi.fn();

    setOriginalModel(req, "claude-sonnet-4-20250514");
    setProxyWarnings(req, ["top_k stripped"]);
    setProviderResponse(req, { id: "x", model: "y", content: [], stopReason: null, usage: { inputTokens: 0, outputTokens: 0 } });

    responseTransformMiddleware(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith("X-Proxy-Warnings", "top_k stripped");
  });

  it("passes with no provider response", () => {
    const next = vi.fn();
    responseTransformMiddleware({ body: {} } as Request, {} as Response, next);
    expect(next).toHaveBeenCalled();
  });
});
