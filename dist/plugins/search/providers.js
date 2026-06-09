"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSearchProvider = createSearchProvider;
const fetch_1 = require("../../utils/fetch");
const errors_1 = require("../../utils/errors");
const providers = {
    tavily: {
        url: "https://api.tavily.com/search", method: "POST",
        headers: () => ({ "Content-Type": "application/json" }),
        body: (q) => JSON.stringify({ query: q, max_results: 5 }),
        pick: (d) => d.results || [],
    },
    bocha: {
        url: "https://api.bochaai.com/v1/ai/search", method: "GET",
        headers: (key) => ({ Authorization: `Bearer ${key}` }),
        pick: (d) => (d.data?.documents || []),
    },
    brave: {
        url: "https://api.search.brave.com/res/v1/web/search", method: "GET",
        headers: (key) => ({ "X-Subscription-Token": key, Accept: "application/json" }),
        pick: (d) => (d.web?.results || []),
    },
};
function createSearchProvider(name, apiKey) {
    const p = providers[name];
    if (!p)
        return null;
    return {
        name,
        async search(query) {
            const headers = p.headers(apiKey);
            const url = p.method === "GET" ? `${p.url}?q=${encodeURIComponent(query)}&count=5` : p.url;
            const init = { method: p.method, headers };
            if (p.body)
                init.body = p.body(query);
            const res = await (0, fetch_1.fetchWithTimeout)(url, init, 10_000);
            if (!res.ok)
                throw new errors_1.ProviderError(`${name} search error (${res.status})`, res.status);
            return (p.pick((await res.json()))).map((r) => ({ title: r.title, url: r.url, snippet: r.content || r.description || "" }));
        },
    };
}
//# sourceMappingURL=providers.js.map