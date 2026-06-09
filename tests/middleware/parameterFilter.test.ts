import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { parameterFilterMiddleware } from "../../src/middleware/parameterFilter";
import { getProxyWarnings } from "../../src/middleware/context";

describe("parameterFilterMiddleware", () => {
  let req: Partial<Request>;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    req = { body: {} };
    next = vi.fn();
  });

  it("strips top_k and service_tier", () => {
    req.body = {
      model: "test", max_tokens: 100, messages: [],
      top_k: 40, service_tier: "auto",
    };
    parameterFilterMiddleware(req as Request, {} as Response, next);

    expect(req.body).not.toHaveProperty("top_k");
    expect(req.body).not.toHaveProperty("service_tier");
    expect(req.body).toHaveProperty("model");
    expect(next).toHaveBeenCalled();
  });

  it("warns about budget_tokens", () => {
    req.body = {
      model: "test", max_tokens: 100, messages: [],
      thinking: { type: "enabled", budget_tokens: 16000 },
    };
    parameterFilterMiddleware(req as Request, {} as Response, next);

    expect(getProxyWarnings(req as Request)).toContain("thinking.budget_tokens is ignored by upstream");
  });

  it("strips image and document content blocks", () => {
    req.body = {
      model: "test", max_tokens: 100,
      messages: [{
        role: "user", content: [
          { type: "text", text: "hello" },
          { type: "image", source: { type: "base64", media_type: "image/png", data: "aaa" } },
          { type: "document", source: {} },
        ],
      }],
    };
    parameterFilterMiddleware(req as Request, {} as Response, next);

    expect(req.body.messages[0].content).toHaveLength(1);
    expect(req.body.messages[0].content[0].type).toBe("text");
  });

  it("keeps text, tool_use, tool_result blocks", () => {
    req.body = {
      model: "test", max_tokens: 100,
      messages: [{
        role: "user", content: [
          { type: "text", text: "hello" },
          { type: "tool_use", id: "1", name: "f", input: {} },
          { type: "tool_result", tool_use_id: "1", content: "done" },
        ],
      }],
    };
    parameterFilterMiddleware(req as Request, {} as Response, next);

    expect(req.body.messages[0].content).toHaveLength(3);
  });
});
