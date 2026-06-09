import type { Logger } from "../../utils/logger";
import { HookPoint, type HookContext, type HookResult, type Plugin } from "../interface";
export declare class VisionPlugin implements Plugin {
    private logger;
    readonly id = "vision";
    readonly name = "Image Understanding";
    readonly hooks: HookPoint[];
    private provider;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    execute(hook: HookPoint, ctx: HookContext): Promise<HookResult>;
}
//# sourceMappingURL=index.d.ts.map