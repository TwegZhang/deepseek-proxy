import type { Logger } from "../utils/logger";
import type { Plugin } from "./interface";
import { HookPoint, type HookContext, type HookResult } from "./interface";
export declare class PluginEngine {
    private logger;
    private plugins;
    private hookIndex;
    constructor(logger: Logger);
    register(plugin: Plugin): void;
    initializeAll(): Promise<void>;
    executeHook(hook: HookPoint, ctx: HookContext): Promise<HookResult>;
    getPlugins(): Plugin[];
}
//# sourceMappingURL=engine.d.ts.map