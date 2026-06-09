import type { Logger } from "../utils/logger";
import type { Plugin } from "./interface";
import { HookPoint, type HookContext, type HookResult } from "./interface";
import { ProxyError } from "../utils/errors";

export class PluginEngine {
  private plugins = new Map<string, Plugin>();

  constructor(private logger: Logger) {}

  register(plugin: Plugin): void {
    this.plugins.set(plugin.id, plugin);
    this.logger.info({ pluginId: plugin.id, hooks: plugin.hooks }, "Plugin registered");
  }

  async initializeAll(): Promise<void> {
    for (const plugin of this.plugins.values()) await plugin.initialize();
  }

  async executeHook(hook: HookPoint, ctx: HookContext): Promise<HookResult> {
    let modified = false;
    for (const plugin of this.plugins.values()) {
      if (!plugin.hooks.includes(hook)) continue;
      try {
        const result = await plugin.execute(hook, ctx);
        if (result.abort) throw new ProxyError(`Plugin "${plugin.id}" aborted: ${result.error || "unknown"}`, 400, "PLUGIN_ABORT");
        if (result.modified) modified = true;
      } catch (err) {
        if (err instanceof ProxyError) throw err;
        this.logger.error({ err, pluginId: plugin.id, hook }, "Plugin execution failed");
      }
    }
    return { modified };
  }

  getPlugins(): Plugin[] {
    return [...this.plugins.values()];
  }
}
