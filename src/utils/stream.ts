import type { MessagesResponse } from "../models/anthropic";

export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncIterable<unknown> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const jsonStr = trimmed.slice(6);
      if (jsonStr === "[DONE]") return;
      try { yield JSON.parse(jsonStr); } catch { /* skip */ }
    }
  }
}

interface SSESink {
  setHeader(name: string, value: string): unknown;
  write(chunk: string): unknown;
  end(): unknown;
}

/**
 * 把完整的 Anthropic 响应合成为标准 SSE 事件序列回放给客户端。
 * 用于"内部非流式跑工具循环、对客户端保持流式协议"的场景（vision 按需二次识别）。
 */
export function replayAsSSE(resp: MessagesResponse, res: SSESink): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (event: Record<string, unknown>) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  send({
    type: "message_start",
    message: {
      id: resp.id, type: "message", role: "assistant", model: resp.model,
      content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: resp.usage.input_tokens, output_tokens: 0 },
    },
  });

  resp.content.forEach((block, i) => {
    if (block.type === "text") {
      send({ type: "content_block_start", index: i, content_block: { type: "text", text: "" } });
      send({ type: "content_block_delta", index: i, delta: { type: "text_delta", text: block.text } });
    } else if (block.type === "tool_use") {
      send({ type: "content_block_start", index: i, content_block: { type: "tool_use", id: block.id, name: block.name, input: {} } });
      send({ type: "content_block_delta", index: i, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input ?? {}) } });
    } else if (block.type === "thinking") {
      send({ type: "content_block_start", index: i, content_block: { type: "thinking", thinking: "" } });
      send({ type: "content_block_delta", index: i, delta: { type: "thinking_delta", thinking: block.thinking } });
      if (block.signature) send({ type: "content_block_delta", index: i, delta: { type: "signature_delta", signature: block.signature } });
    } else {
      send({ type: "content_block_start", index: i, content_block: block });
    }
    send({ type: "content_block_stop", index: i });
  });

  send({
    type: "message_delta",
    delta: { stop_reason: resp.stop_reason, stop_sequence: resp.stop_sequence ?? null },
    usage: { output_tokens: resp.usage.output_tokens },
  });
  send({ type: "message_stop" });
  res.write("data: [DONE]\n\n");
  res.end();
}
