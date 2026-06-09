import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { requestTransformMiddleware } from "../../src/middleware/requestTransform";
import { getProviderRequest } from "../../src/middleware/context";

describe("requestTransformMiddleware", () => {
  let req: Partial<Request>;
  let next: ReturnType<typeof vi.fn>;
  beforeEach(() => { req = { body: {} }; next = vi.fn(); });

  it("converts string content to ContentBlock array", () => {
    req.body = { model: "test", max_tokens: 100, messages: [{ role: "user", content: "Hello" }] };
    requestTransformMiddleware(req as Request, {} as Response, next);

    const pr = getProviderRequest(req as Request);
    expect(pr).toBeDefined();
    expect(pr!.messages[0].content).toEqual([{ type: "text", text: "Hello" }]);
    expect(pr!.maxTokens).toBe(100);
  });

  it("preserves array content", () => {
    req.body = { model: "test", max_tokens: 200, messages: [{ role: "user", content: [{ type: "text", text: "A" }, { type: "text", text: "B" }] }] };
    requestTransformMiddleware(req as Request, {} as Response, next);

    expect(getProviderRequest(req as Request)!.messages[0].content).toHaveLength(2);
  });

  it("handles system as string", () => {
    req.body = { model: "test", max_tokens: 100, system: "Be helpful", messages: [{ role: "user", content: "Hi" }] };
    requestTransformMiddleware(req as Request, {} as Response, next);
    expect(getProviderRequest(req as Request)!.system).toBe("Be helpful");
  });

  it("handles system as array", () => {
    req.body = { model: "test", max_tokens: 100, system: [{ type: "text", text: "R1" }, { type: "text", text: "R2" }], messages: [{ role: "user", content: "Hi" }] };
    requestTransformMiddleware(req as Request, {} as Response, next);
    expect(getProviderRequest(req as Request)!.system).toBe("R1\nR2");
  });

  it("defaults stream to false", () => {
    req.body = { model: "test", max_tokens: 100, messages: [{ role: "user", content: "Hi" }] };
    requestTransformMiddleware(req as Request, {} as Response, next);
    expect(getProviderRequest(req as Request)!.stream).toBe(false);
  });

  it("passes through with no messages", () => {
    req.body = undefined;
    requestTransformMiddleware(req as Request, {} as Response, next);
    expect(next).toHaveBeenCalled();
  });
});
