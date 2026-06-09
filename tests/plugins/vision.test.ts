import { describe, it, expect, vi } from "vitest";
import { OpenAIVisionProvider } from "../../src/plugins/vision/openai-compatible";
import type { Logger } from "../../src/utils/logger";

const logger: Logger = {
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  child: () => logger as Logger,
} as unknown as Logger;

describe("OpenAIVisionProvider", () => {
  it("calls OpenAI-compatible endpoint and returns description", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "A cat on a chair" } }] }),
    }));

    const provider = new OpenAIVisionProvider(logger, {
      base_url: "https://api.example.com/v1",
      api_key: "sk-test",
      model: "test-model",
      max_tokens: 256,
    });

    const result = await provider.describe("abc123", "image/png");
    expect(result).toBe("A cat on a chair");
  });

  it("throws on API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    }));

    const provider = new OpenAIVisionProvider(logger, {
      base_url: "https://api.example.com/v1",
      api_key: "bad-key",
      model: "x",
      max_tokens: 100,
    });

    await expect(provider.describe("abc", "image/png")).rejects.toThrow("Vision API error");
  });

  it("throws on empty response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: {} }] }),
    }));

    const provider = new OpenAIVisionProvider(logger, {
      base_url: "https://api.example.com/v1",
      api_key: "sk-test",
      model: "x",
      max_tokens: 100,
    });

    await expect(provider.describe("abc", "image/png")).rejects.toThrow("empty response");
  });
});
