"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchPlugin = void 0;
const interface_1 = require("../interface");
const config_1 = require("../../config");
const providers_1 = require("./providers");
class SearchPlugin {
    logger;
    id = "search";
    name = "Server-Side Search";
    hooks = [interface_1.HookPoint.POST_CALL];
    searchProvider = null;
    constructor(logger) {
        this.logger = logger;
    }
    async initialize() {
        const config = (0, config_1.getConfig)().plugins.search;
        const apiKey = process.env.DP_SEARCH_API_KEY;
        if (!apiKey) {
            this.logger.warn("Search plugin disabled — set DP_SEARCH_API_KEY in .env");
            return;
        }
        this.searchProvider = (0, providers_1.createSearchProvider)(config.provider, apiKey);
        if (!this.searchProvider) {
            this.logger.warn({ provider: config.provider }, "Unknown search provider");
            return;
        }
        this.logger.info({ provider: config.provider }, "Search plugin ready");
    }
    async execute(hook, ctx) {
        if (hook !== interface_1.HookPoint.POST_CALL || !this.searchProvider)
            return {};
        if (ctx.searchReentry)
            return {}; // one-shot guard: skip on re-entry to avoid wasted API calls
        if (!ctx.providerResponse)
            return {};
        const toolUses = findSearchToolUses(ctx.providerResponse.content);
        if (toolUses.length === 0)
            return {};
        const results = await Promise.all(toolUses.map(async (tu) => {
            try {
                const query = typeof tu.input?.query === "string" ? tu.input.query : JSON.stringify(tu.input);
                const r = await this.searchProvider.search(query);
                return { toolUseId: tu.id, results: r };
            }
            catch (err) {
                this.logger.error({ err, toolUseId: tu.id }, "Search failed");
                return { toolUseId: tu.id, results: [] };
            }
        }));
        const toolResults = results.map((r) => ({
            type: "tool_result",
            tool_use_id: r.toolUseId,
            content: JSON.stringify(r.results),
        }));
        const messages = ctx.providerRequest?.messages;
        if (messages) {
            messages.push({
                role: "assistant",
                content: toolUses.map((tu) => ({ type: "tool_use", id: tu.id, name: tu.name, input: tu.input })),
            });
            messages.push({ role: "user", content: toolResults });
        }
        ctx.searchReentry = true;
        return { modified: true };
    }
}
exports.SearchPlugin = SearchPlugin;
function findSearchToolUses(content) {
    const result = [];
    for (const block of content) {
        const b = block;
        if ((b.type === "tool_use" || b.type === "server_tool_use") && String(b.name || "").includes("search")) {
            result.push({ id: b.id, name: b.name, input: b.input || {} });
        }
    }
    return result;
}
//# sourceMappingURL=index.js.map