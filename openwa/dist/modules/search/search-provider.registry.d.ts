import type { SearchProvider } from './search.types';
export declare class SearchProviderRegistry {
    private readonly providers;
    private activeId;
    register(provider: SearchProvider): void;
    unregister(id: string): void;
    setActive(id: string): void;
    active(): SearchProvider | null;
    list(): SearchProvider[];
}
