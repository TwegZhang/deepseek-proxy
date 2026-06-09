import { Router } from "express";
import type { Logger } from "../utils/logger";
import type { LLMProvider } from "../providers/interface";
import type { PluginEngine } from "../plugins/engine";
import type { Config } from "../config/schema";
export declare function createRoutes(deps: {
    config: Config;
    logger: Logger;
    provider: LLMProvider;
    pluginEngine: PluginEngine;
}): Router;
//# sourceMappingURL=index.d.ts.map