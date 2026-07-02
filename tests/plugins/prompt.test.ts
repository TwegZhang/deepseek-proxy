import { describe, it, expect } from "vitest";
import { buildVisionPrompt, wrapDescription, DEFAULT_TEMPLATE } from "../../src/plugins/vision/prompt";

describe("buildVisionPrompt", () => {
  it("embeds user text and language-follow instruction", () => {
    const p = buildVisionPrompt("这个报错怎么解决？");
    expect(p).toContain("这个报错怎么解决？");
    expect(p).toContain("same language as this message");
    expect(p).not.toContain("{USER_CONTEXT}");
  });

  it("falls back to blind description when no user text", () => {
    const p = buildVisionPrompt(null);
    expect(p).toContain("No accompanying message");
    expect(p).toContain("default to Chinese");
    expect(p).not.toContain("{USER_CONTEXT}");
  });

  it("treats whitespace-only user text as absent", () => {
    expect(buildVisionPrompt("   \n  ")).toContain("No accompanying message");
  });

  it("truncates overly long user text", () => {
    const long = "x".repeat(2000);
    const p = buildVisionPrompt(long);
    expect(p).toContain("[truncated]");
    expect(p).not.toContain("x".repeat(600));
  });

  it("uses custom template when provided", () => {
    const p = buildVisionPrompt("hello", "CUSTOM: {USER_CONTEXT} END");
    expect(p.startsWith("CUSTOM: ")).toBe(true);
    expect(p).toContain("hello");
    expect(p.endsWith(" END")).toBe(true);
    expect(p).not.toContain(DEFAULT_TEMPLATE.slice(0, 30));
  });
});

describe("wrapDescription", () => {
  it("wraps with transcription protocol and stable image numbering", () => {
    const w = wrapDescription("A red button", 2);
    expect(w).toContain('<image_transcription source="vision-model" image="2">');
    expect(w).toContain("A red button");
    expect(w).toContain("</image_transcription>");
    expect(w).toContain("非原图");
  });

  it("output is deterministic (prefix-cache stable)", () => {
    expect(wrapDescription("t", 1, true)).toBe(wrapDescription("t", 1, true));
  });

  it("omits analyze_image hint by default", () => {
    expect(wrapDescription("t", 1)).not.toContain("analyze_image");
  });

  it("includes analyze_image hint when enabled", () => {
    expect(wrapDescription("t", 1, true)).toContain("analyze_image");
  });
});
