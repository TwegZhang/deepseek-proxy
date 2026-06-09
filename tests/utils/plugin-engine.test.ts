import { describe, it, expect, vi } from "vitest";
import { PluginEngine } from "../../src/plugins/engine";
import { HookPoint, type Plugin, type HookContext } from "../../src/plugins/interface";
import { createLogger } from "../../src/utils/logger";

describe("PluginEngine", () => {
  it("registers and lists plugins", () => {
    const engine = new PluginEngine(createLogger("silent"));
    engine.register({ id: "t", name: "T", hooks: [HookPoint.PRE_PROCESS], initialize: vi.fn().mockResolvedValue(undefined), execute: vi.fn().mockResolvedValue({}) });
    expect(engine.getPlugins()).toHaveLength(1);
  });

  it("dispatches to registered hook", async () => {
    const engine = new PluginEngine(createLogger("silent"));
    const p: Plugin = { id: "p", name: "P", hooks: [HookPoint.PRE_PROCESS], initialize: vi.fn().mockResolvedValue(undefined), execute: vi.fn().mockResolvedValue({ modified: true }) };
    engine.register(p);
    const result = await engine.executeHook(HookPoint.PRE_PROCESS, { req: { body: {} } } as HookContext);
    expect(result.modified).toBe(true);
  });

  it("skips plugin for wrong hook", async () => {
    const engine = new PluginEngine(createLogger("silent"));
    const p: Plugin = { id: "p", name: "P", hooks: [HookPoint.PRE_PROCESS], initialize: vi.fn().mockResolvedValue(undefined), execute: vi.fn().mockResolvedValue({}) };
    engine.register(p);
    await engine.executeHook(HookPoint.POST_CALL, { req: { body: {} } } as HookContext);
    expect(p.execute).not.toHaveBeenCalled();
  });

  it("throws on abort", async () => {
    const engine = new PluginEngine(createLogger("silent"));
    engine.register({ id: "abort", name: "A", hooks: [HookPoint.PRE_PROCESS], initialize: vi.fn().mockResolvedValue(undefined), execute: vi.fn().mockResolvedValue({ abort: true, error: "no" }) });
    await expect(engine.executeHook(HookPoint.PRE_PROCESS, { req: { body: {} } } as HookContext)).rejects.toThrow("no");
  });

  it("initializes all", async () => {
    const engine = new PluginEngine(createLogger("silent"));
    const p1: Plugin = { id: "a", name: "A", hooks: [], initialize: vi.fn().mockResolvedValue(undefined), execute: vi.fn().mockResolvedValue({}) };
    engine.register(p1);
    await engine.initializeAll();
    expect(p1.initialize).toHaveBeenCalled();
  });
});
