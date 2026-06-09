"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSSEStream = parseSSEStream;
async function* parseSSEStream(reader) {
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: "))
                continue;
            const jsonStr = trimmed.slice(6);
            if (jsonStr === "[DONE]")
                return;
            try {
                yield JSON.parse(jsonStr);
            }
            catch { /* skip */ }
        }
    }
}
//# sourceMappingURL=stream.js.map