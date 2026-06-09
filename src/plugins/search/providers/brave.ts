import type { SearchProvider, SearchResult } from "../interface";
import { fetchWithTimeout } from "../../../utils/fetch";
import { ProviderError } from "../../../utils/errors";

export class BraveProvider implements SearchProvider {
  readonly name = "brave";
  constructor(private _key: string) {}
  async search(query: string): Promise<SearchResult[]> {
    const res = await fetchWithTimeout(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      { headers: { "X-Subscription-Token": this._key, Accept: "application/json" } },
      10_000
    );
    if (!res.ok) throw new ProviderError(`Brave search error (${res.status})`, res.status);
    const data = (await res.json()) as { web?: { results?: Array<{ title: string; url: string; description: string }> } };
    return (data.web?.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.description }));
  }
}
