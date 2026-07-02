import type { Logger } from "../../utils/logger";
import type { ContentBlock } from "../../models/anthropic";
import { HookPoint, type HookContext, type HookResult, type Plugin } from "../interface";
import { getConfig } from "../../config";
import { createSearchProvider } from "./providers";
import type { SearchProvider } from "./interface";

export class SearchPlugin implements Plugin {
  readonly id = "search";
  readonly name = "Server-Side Search";
  readonly hooks = [HookPoint.POST_CALL];

  private searchProvider: SearchProvider | null = null;

  constructor(private logger: Logger) {}

  async initialize(): Promise<void> {
    const config = getConfig().plugins.search;
    const apiKey = process.env.DP_SEARCH_API_KEY;
    if (!apiKey) {
      this.logger.warn("Search plugin disabled — set DP_SEARCH_API_KEY in .env");
      return;
    }

    this.searchProvider = createSearchProvider(config.provider, apiKey);
    if (!this.searchProvider) {
      this.logger.warn({ provider: config.provider }, "Unknown search provider");
      return;
    }

    this.logger.info({ provider: config.provider }, "Search plugin ready");
  }

  async execute(hook: HookPoint, ctx: HookContext): Promise<HookResult> {
    if (hook !== HookPoint.POST_CALL || !this.searchProvider) return {};
    if (ctx.searchReentry) return {}; // one-shot guard: skip on re-entry to avoid wasted API calls
    if (!ctx.providerResponse) return {};

    const toolUses = findSearchToolUses(ctx.providerResponse.content);
    if (toolUses.length === 0) return {};

    const queries = toolUses.map((t) => t.input?.query || "(unknown)");
    this.logger.info({ queries }, "search: executing queries");

    const results = await Promise.all(
      toolUses.map(async (tu) => {
        try {
          const query = typeof tu.input?.query === "string" ? tu.input.query : JSON.stringify(tu.input);
          const r = await this.searchProvider!.search(query);
          return { toolUseId: tu.id, results: r };
        } catch (err) {
          this.logger.error({ err, toolUseId: tu.id }, "Search failed");
          return { toolUseId: tu.id, results: [] };
        }
      })
    );

    const toolResults: ContentBlock[] = results.map((r) => ({
      type: "tool_result",
      tool_use_id: r.toolUseId,
      content: JSON.stringify(r.results),
    }));

    const messages = ctx.providerRequest?.messages;
    if (messages) {
      messages.push({
        role: "assistant",
        content: toolUses.map((tu) => ({ type: "tool_use" as const, id: tu.id, name: tu.name, input: tu.input })),
      });
      messages.push({ role: "user", content: toolResults });
    }

    const totalResults = results.reduce((sum, r) => sum + r.results.length, 0);
    this.logger.info({ totalResults, queries: results.map((r) => r.results.length) }, "search: results injected, re-entering");

    ctx.searchReentry = true; // one-shot guard（本插件重入后不再拦截）
    ctx.reenter = true; // 请求 pipeline 重入供应商
    return { modified: true };
  }
}

function findSearchToolUses(content: ContentBlock[]): Array<{ id: string; name: string; input: Record<string, unknown> }> {
  const result: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
  for (const block of content) {
    const b = block as unknown as Record<string, unknown>;
    if ((b.type === "tool_use" || b.type === "server_tool_use") && String(b.name || "").includes("search")) {
      result.push({ id: b.id as string, name: b.name as string, input: (b.input as Record<string, unknown>) || {} });
    }
  }
  return result;
}
