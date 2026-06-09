import type { Logger } from "../../utils/logger";
import { HookPoint, type HookContext, type HookResult, type Plugin } from "../interface";
export declare class SearchPlugin implements Plugin {
    private logger;
    readonly id = "search";
    readonly name = "Server-Side Search";
    readonly hooks: HookPoint[];
    private searchProvider;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    execute(hook: HookPoint, ctx: HookContext): Promise<HookResult>;
}
//# sourceMappingURL=index.d.ts.map