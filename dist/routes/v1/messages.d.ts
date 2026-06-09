import { Router } from "express";
import type { Logger } from "../../utils/logger";
import type { LLMProvider } from "../../providers/interface";
import type { PluginEngine } from "../../plugins/engine";
import type { Config } from "../../config/schema";
export declare function createMessagesRouter(deps: {
    config: Config;
    logger: Logger;
    provider: LLMProvider;
    pluginEngine: PluginEngine;
}): Router;
//# sourceMappingURL=messages.d.ts.map