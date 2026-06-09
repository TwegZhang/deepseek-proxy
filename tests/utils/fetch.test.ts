import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithTimeout } from "../../src/utils/fetch";

describe("fetchWithTimeout", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("passes method, headers, body to fetch and sets AbortSignal", async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", spy);

    await fetchWithTimeout("https://x.com/api", { method: "POST", headers: { a: "1" }, body: "{}" }, 5000);

    const init = spy.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ a: "1" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects on abort", async () => {
    vi.stubGlobal("fetch", (_u: string, init?: RequestInit) =>
      new Promise((_, reject) => { init?.signal?.addEventListener("abort", () => reject(new DOMException("a", "AbortError"))); }) as Promise<Response>
    );
    await expect(fetchWithTimeout("x", {}, 1)).rejects.toThrow("a");
  });
});
