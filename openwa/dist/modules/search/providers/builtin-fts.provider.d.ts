import { DataSource } from 'typeorm';
import type { SearchProvider, SearchQuery, SearchResults } from '../search.types';
export declare class BuiltInFtsProvider implements SearchProvider {
    private readonly dataSource;
    readonly id = "builtin-fts";
    readonly label = "Built-in database full-text search";
    constructor(dataSource: DataSource);
    private ftsAvailable;
    private probeFts;
    private ensureFts;
    search(query: SearchQuery): Promise<SearchResults>;
    health(): Promise<{
        ok: boolean;
        detail?: string;
    }>;
    private mapRow;
    private static sqlitePlaceholder;
    private pgPlaceholder;
    private buildSqlite;
    private buildPostgres;
    private applyFilters;
    private count;
}
