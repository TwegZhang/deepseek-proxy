import type { SearchProvider, SearchResult } from "../interface";
import { fetchWithTimeout } from "../../../utils/fetch";
import { ProviderError } from "../../../utils/errors";

export class TavilyProvider implements SearchProvider {
  readonly name = "tavily";
  constructor(private key: string) {}
  async search(query: string): Promise<SearchResult[]> {
    const res = await fetchWithTimeout(
      "https://api.tavily.com/search",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apikey: this.key, query, max_results: 5 }) },
      10_000
    );
    if (!res.ok) throw new ProviderError(`Tavily search error (${res.status})`, res.status);
    const data = (await res.json()) as { results?: Array<{ title: string; url: string; content: string }> };
    return (data.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.content }));
  }
}
