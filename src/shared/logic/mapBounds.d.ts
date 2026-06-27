import type { CityName } from '../types';
export declare const TILE_URL = "/api/tiles/{z}/{x}/{y}";
export declare const TILE_MIN_ZOOM = 6;
export declare const TILE_MAX_ZOOM = 13;
/** Leaflet expects bounds as [[south, west], [north, east]]. */
export type LatLngBounds = [[number, number], [number, number]];
export type CityRegion = {
    name: CityName;
    bounds: LatLngBounds;
    minZoom: number;
    maxZoom: number;
};
export declare const CITY_REGIONS: Record<CityName, CityRegion>;
export declare const SUPPORTED_CITY_NAMES: CityName[];
/**
 * A scope is a named bundle of one or more cities, used when a subreddit
 * covers multiple cities at once (e.g. r/InternationalAndes → Quito + Bogotá).
 */
export type ScopeName = 'Andes';
export declare const CITY_SCOPES: Record<ScopeName, CityName[]>;
export type ScopeRegion = {
    name: ScopeName;
    bounds: LatLngBounds;
    minZoom: number;
    maxZoom: number;
};
export declare const SCOPE_REGIONS: Record<ScopeName, ScopeRegion>;
export declare const SCOPE_NAMES: ScopeName[];
export declare function isScopeName(s: string): s is ScopeName;
/** Resolve any setting value (city, scope name, or comma-separated city list) to a list of cities. */
export declare function expandToCities(value: string): CityName[] | null;
/** Combined Leaflet bounds covering every city in the list. */
export declare function combinedBounds(cities: readonly CityName[]): LatLngBounds;
/** Subreddit name (any case, with or without `r/`) → CityName | null. */
export declare function inferCityFromSubreddit(subredditName: string | undefined | null): CityName | null;
/** Subreddit name → scope name, for subs that cover multiple cities. */
export declare function inferScopeFromSubreddit(subredditName: string | undefined | null): ScopeName | null;
