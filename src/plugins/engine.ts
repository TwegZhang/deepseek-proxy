import type { Logger } from "../utils/logger";
import type { Plugin } from "./interface";
import { HookPoint, type HookContext, type HookResult } from "./interface";
import { ProxyError } from "../utils/errors";

export class PluginEngine {
  private plugins = new Map<string, Plugin>();
  private hookIndex = new Map<HookPoint, Plugin[]>();

  constructor(private logger: Logger) {}

  register(plugin: Plugin): void {
    this.plugins.set(plugin.id, plugin);

    // Index by hook point for O(1) dispatch
    for (const hook of plugin.hooks) {
      const list = this.hookIndex.get(hook);
      if (list) list.push(plugin);
      else this.hookIndex.set(hook, [plugin]);
    }

    this.logger.info({ pluginId: plugin.id, hooks: plugin.hooks }, "Plugin registered");
  }

  async initializeAll(): Promise<void> {
    for (const plugin of this.plugins.values()) await plugin.initialize();
  }

  async executeHook(hook: HookPoint, ctx: HookContext): Promise<HookResult> {
    const plugins = this.hookIndex.get(hook);
    if (!plugins || plugins.length === 0) return {};

    let modified = false;
    for (const plugin of plugins) {
      try {
        const result = await plugin.execute(hook, ctx);
        if (result.abort) {
          throw new ProxyError(`Plugin "${plugin.id}" aborted: ${result.error || "unknown"}`, 400, "PLUGIN_ABORT");
        }
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
