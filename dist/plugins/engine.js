"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginEngine = void 0;
const errors_1 = require("../utils/errors");
class PluginEngine {
    logger;
    plugins = new Map();
    hookIndex = new Map();
    constructor(logger) {
        this.logger = logger;
    }
    register(plugin) {
        this.plugins.set(plugin.id, plugin);
        // Index by hook point for O(1) dispatch
        for (const hook of plugin.hooks) {
            const list = this.hookIndex.get(hook);
            if (list)
                list.push(plugin);
            else
                this.hookIndex.set(hook, [plugin]);
        }
        this.logger.info({ pluginId: plugin.id, hooks: plugin.hooks }, "Plugin registered");
    }
    async initializeAll() {
        for (const plugin of this.plugins.values())
            await plugin.initialize();
    }
    async executeHook(hook, ctx) {
        const plugins = this.hookIndex.get(hook);
        if (!plugins || plugins.length === 0)
            return {};
        let modified = false;
        for (const plugin of plugins) {
            try {
                const result = await plugin.execute(hook, ctx);
                if (result.abort) {
                    throw new errors_1.ProxyError(`Plugin "${plugin.id}" aborted: ${result.error || "unknown"}`, 400, "PLUGIN_ABORT");
                }
                if (result.modified)
                    modified = true;
            }
            catch (err) {
                if (err instanceof errors_1.ProxyError)
                    throw err;
                this.logger.error({ err, pluginId: plugin.id, hook }, "Plugin execution failed");
            }
        }
        return { modified };
    }
    getPlugins() {
        return [...this.plugins.values()];
    }
}
exports.PluginEngine = PluginEngine;
//# sourceMappingURL=engine.js.map