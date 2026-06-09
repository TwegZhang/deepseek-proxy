import { describe, it, expect } from "vitest";
import { parseSSEStream } from "../../src/utils/stream";

function mockReader(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) { controller.enqueue(encoder.encode(chunks[i])); i++; }
      else controller.close();
    },
  }).getReader();
}

describe("parseSSEStream", () => {
  it("parses a single SSE event", async () => {
    const reader = mockReader(['data: {"type":"msg_start","id":"1"}\n\n']);
    const results: unknown[] = [];
    for await (const e of parseSSEStream(reader)) results.push(e);
    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).type).toBe("msg_start");
  });

  it("parses multiple events in one chunk", async () => {
    const reader = mockReader(['data: {"t":"a"}\n\ndata: {"t":"b"}\n\n']);
    const results: unknown[] = [];
    for await (const e of parseSSEStream(reader)) results.push(e);
    expect(results).toHaveLength(2);
  });

  it("stops at [DONE] sentinel", async () => {
    const reader = mockReader(['data: {"t":"a"}\n\ndata: [DONE]\n\n']);
    const results: unknown[] = [];
    for await (const e of parseSSEStream(reader)) results.push(e);
    expect(results).toHaveLength(1);
  });

  it("skips non-data lines", async () => {
    const reader = mockReader(['event: ping\ndata: {"t":"real"}\n\n']);
    const results: unknown[] = [];
    for await (const e of parseSSEStream(reader)) results.push(e);
    expect(results).toHaveLength(1);
  });
});
