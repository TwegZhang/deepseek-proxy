import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { authMiddleware } from "../../src/middleware/auth";
import { AuthError } from "../../src/utils/errors";

vi.mock("../../src/config", () => ({
  getConfig: () => ({
    auth: {
      proxy_key: "sk-test-key",
      keys: [],
    },
  }),
}));

describe("authMiddleware", () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
  });

  it("allows request with correct proxy key", () => {
    const req = {
      headers: { "x-api-key": "sk-test-key" },
    } as unknown as Request;

    authMiddleware(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects request with wrong proxy key", () => {
    const req = {
      headers: { "x-api-key": "wrong-key" },
    } as unknown as Request;

    authMiddleware(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthError));
  });

  it("rejects request with missing api key header", () => {
    const req = { headers: {} } as unknown as Request;

    authMiddleware(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthError));
  });
});
