import type { SearchProvider, SearchResult } from "./interface";
import { fetchWithTimeout } from "../../utils/fetch";
import { ProviderError } from "../../utils/errors";

type Parsed = Array<{ title: string; url: string; content?: string; description?: string }>;

const providers: Record<string, { url: string; method: "GET" | "POST"; headers: (key: string) => Record<string, string>; body?: (q: string) => string; pick: (d: Record<string, unknown>) => Parsed }> = {
  tavily: {
    url: "https://api.tavily.com/search", method: "POST",
    headers: () => ({ "Content-Type": "application/json" }),
    body: (q) => JSON.stringify({ query: q, max_results: 5 }),
    pick: (d) => (d.results as Parsed) || [],
  },
  bocha: {
    url: "https://api.bochaai.com/v1/ai/search", method: "GET",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    pick: (d) => ((d.data as { documents?: Parsed })?.documents || []),
  },
  brave: {
    url: "https://api.search.brave.com/res/v1/web/search", method: "GET",
    headers: (key) => ({ "X-Subscription-Token": key, Accept: "application/json" }),
    pick: (d) => ((d.web as { results?: Parsed })?.results || []),
  },
};

export function createSearchProvider(name: string, apiKey: string): SearchProvider | null {
  const p = providers[name];
  if (!p) return null;

  return {
    name,
    async search(query: string): Promise<SearchResult[]> {
      const headers = p.headers(apiKey);
      const url = p.method === "GET" ? `${p.url}?q=${encodeURIComponent(query)}&count=5` : p.url;
      const init: RequestInit = { method: p.method, headers };
      if (p.body) init.body = p.body(query);
      const res = await fetchWithTimeout(url, init, 10_000);
      if (!res.ok) throw new ProviderError(`${name} search error (${res.status})`, res.status);
      return (p.pick((await res.json()) as Record<string, unknown>)).map((r) => ({ title: r.title, url: r.url, snippet: r.content || r.description || "" }));
    },
  };
}
