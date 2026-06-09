import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { modelTranslateMiddleware } from "../../src/middleware/modelTranslate";
import { getOriginalModel } from "../../src/middleware/context";

vi.mock("../../src/config", () => ({
  getConfig: () => ({
    model_mapping: {
      "claude-sonnet-4-20250514": { provider: "deepseek", model: "deepseek-v4-flash" },
      "claude-opus-4-20250514": { provider: "deepseek", model: "deepseek-v4-pro" },
      default: { provider: "deepseek", model: "deepseek-v4-flash" },
    },
  }),
}));

describe("modelTranslateMiddleware", () => {
  let req: Partial<Request>;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    req = { body: {} };
    next = vi.fn();
  });

  it("translates claude-opus to deepseek-v4-pro", () => {
    req.body = { model: "claude-opus-4-20250514", messages: [] };
    modelTranslateMiddleware(req as Request, {} as Response, next);

    expect(req.body.model).toBe("deepseek-v4-pro");
    expect(getOriginalModel(req as Request)).toBe("claude-opus-4-20250514");
    expect(next).toHaveBeenCalled();
  });

  it("translates claude-sonnet to deepseek-v4-flash", () => {
    req.body = { model: "claude-sonnet-4-20250514", messages: [] };
    modelTranslateMiddleware(req as Request, {} as Response, next);

    expect(req.body.model).toBe("deepseek-v4-flash");
  });

  it("falls back to default for unknown model", () => {
    req.body = { model: "gpt-5-turbo", messages: [] };
    modelTranslateMiddleware(req as Request, {} as Response, next);

    expect(req.body.model).toBe("deepseek-v4-flash");
  });

  it("passes through when body has no model", () => {
    req.body = { messages: [{ role: "user", content: "hi" }] };
    modelTranslateMiddleware(req as Request, {} as Response, next);
    expect(next).toHaveBeenCalled();
  });
});
