export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}
export interface SearchProvider {
    readonly name: string;
    search(query: string): Promise<SearchResult[]>;
}
//# sourceMappingURL=interface.d.ts.map