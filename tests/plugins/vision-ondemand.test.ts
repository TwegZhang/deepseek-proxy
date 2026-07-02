import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request } from "express";
import { VisionPlugin } from "../../src/plugins/vision";
import { HookPoint, type HookContext } from "../../src/plugins/interface";
import { setVisionImages } from "../../src/middleware/context";
import { replayAsSSE } from "../../src/utils/stream";
import type { ProviderRequest } from "../../src/models/provider";
import type { MessagesResponse, ContentBlock } from "../../src/models/anthropic";
import type { Logger } from "../../src/utils/logger";

const logger: Logger = {
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  child: () => logger as Logger,
} as unknown as Logger;

async function makePlugin(): Promise<VisionPlugin> {
  vi.stubEnv("DP_VISION_BASE_URL", "https://api.example.com/v1");
  vi.stubEnv("DP_VISION_API_KEY", "sk-test");
  vi.stubEnv("DP_VISION_MODEL", "test-vl");
  const plugin = new VisionPlugin(logger);
  await plugin.initialize();
  return plugin;
}

function makeCtx(overrides: Partial<HookContext> = {}): HookContext {
  const req = {} as Request;
  setVisionImages(req, [{ data: "base64data-image-1", media_type: "image/png" }]);
  const providerRequest: ProviderRequest = {
    model: "deepseek-v4-flash",
    messages: [{ role: "user", content: [{ type: "text", text: "看下截图" }] }],
    maxTokens: 4096,
    stream: false,
  };
  return {
    req,
    providerRequest,
    providerResponse: {
      id: "msg_1", model: "deepseek-v4-flash",
      content: [{ type: "tool_use", id: "tu_1", name: "analyze_image", input: { query: "读一下右下角状态栏" } }] as ContentBlock[],
      stopReason: "tool_use",
      usage: { inputTokens: 10, outputTokens: 5 },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("VisionPlugin on-demand analysis (POST_CALL)", () => {
  it("intercepts analyze_image tool_use, injects tool_result, requests re-entry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "状态栏显示 UTF-8 LF TypeScript" } }] }),
    }));
    const plugin = await makePlugin();
    const ctx = makeCtx();

    const result = await plugin.execute(HookPoint.POST_CALL, ctx);

    expect(result.modified).toBe(true);
    expect(ctx.reenter).toBe(true);
    expect(ctx.visionReentryCount).toBe(1);
    const msgs = ctx.providerRequest!.messages;
    expect(msgs).toHaveLength(3);
    expect(msgs[1].role).toBe("assistant");
    const toolResult = msgs[2].content[0] as { type: string; tool_use_id: string; content: string };
    expect(msgs[2].role).toBe("user");
    expect(toolResult.type).toBe("tool_result");
    expect(toolResult.tool_use_id).toBe("tu_1");
    expect(toolResult.content).toContain("状态栏显示 UTF-8");
  });

  it("passes DeepSeek's query to the vision model as context", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "ok" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const plugin = await makePlugin();

    await plugin.execute(HookPoint.POST_CALL, makeCtx());

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const promptText = body.messages[0].content[0].text as string;
    expect(promptText).toContain("读一下右下角状态栏");
  });

  it("returns exhausted tool_result without vision call when budget used up", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const plugin = await makePlugin();
    const ctx = makeCtx({ visionReentryCount: 3 });

    const result = await plugin.execute(HookPoint.POST_CALL, ctx);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.modified).toBe(true);
    expect(ctx.reenter).toBe(true);
    const toolResult = ctx.providerRequest!.messages[2].content[0] as { content: string; is_error?: boolean };
    expect(toolResult.content).toContain("budget exhausted");
    expect(toolResult.is_error).toBe(true);
  });

  it("does nothing when response has no analyze_image tool_use", async () => {
    const plugin = await makePlugin();
    const ctx = makeCtx();
    ctx.providerResponse!.content = [{ type: "text", text: "直接回答" }] as ContentBlock[];

    const result = await plugin.execute(HookPoint.POST_CALL, ctx);

    expect(result.modified).toBeUndefined();
    expect(ctx.reenter).toBeUndefined();
    expect(ctx.providerRequest!.messages).toHaveLength(1);
  });

  it("passes through mixed tool_use (client tools present)", async () => {
    const plugin = await makePlugin();
    const ctx = makeCtx();
    ctx.providerResponse!.content = [
      { type: "tool_use", id: "tu_1", name: "analyze_image", input: { query: "q" } },
      { type: "tool_use", id: "tu_2", name: "client_tool", input: {} },
    ] as ContentBlock[];

    const result = await plugin.execute(HookPoint.POST_CALL, ctx);

    expect(result.modified).toBeUndefined();
    expect(ctx.reenter).toBeUndefined();
  });
});

describe("replayAsSSE", () => {
  it("synthesizes a full Anthropic SSE event sequence", () => {
    const writes: string[] = [];
    const sink = {
      setHeader: vi.fn(),
      write: (chunk: string) => { writes.push(chunk); },
      end: vi.fn(),
    };
    const resp: MessagesResponse = {
      id: "msg_1", type: "message", role: "assistant",
      content: [{ type: "text", text: "最终回答" }],
      model: "claude-sonnet-4-20250514",
      stop_reason: "end_turn",
      usage: { input_tokens: 100, output_tokens: 20 },
    };

    replayAsSSE(resp, sink);

    const events = writes
      .filter((w) => w.startsWith("data: ") && !w.includes("[DONE]"))
      .map((w) => JSON.parse(w.slice(6)));
    expect(events.map((e) => e.type)).toEqual([
      "message_start", "content_block_start", "content_block_delta",
      "content_block_stop", "message_delta", "message_stop",
    ]);
    expect(events[2].delta.text).toBe("最终回答");
    expect(events[4].delta.stop_reason).toBe("end_turn");
    expect(events[4].usage.output_tokens).toBe(20);
    expect(writes[writes.length - 1]).toContain("[DONE]");
    expect(sink.end).toHaveBeenCalled();
    expect(sink.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
  });
});
