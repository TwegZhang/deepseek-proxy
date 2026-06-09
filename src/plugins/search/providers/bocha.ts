import type { SearchProvider, SearchResult } from "../interface";
import { fetchWithTimeout } from "../../../utils/fetch";
import { ProviderError } from "../../../utils/errors";

export class BochaProvider implements SearchProvider {
  readonly name = "bocha";
  constructor(private _key: string) {}
  async search(query: string): Promise<SearchResult[]> {
    const res = await fetchWithTimeout(
      `https://api.bochaai.com/v1/ai/search?query=${encodeURIComponent(query)}&count=5`,
      { headers: { Authorization: `Bearer ${this._key}` } },
      10_000
    );
    if (!res.ok) throw new ProviderError(`Bocha search error (${res.status})`, res.status);
    const data = (await res.json()) as { data?: { documents?: Array<{ title: string; url: string; content: string }> } };
    return (data.data?.documents || []).map((r) => ({ title: r.title, url: r.url, snippet: r.content }));
  }
}
