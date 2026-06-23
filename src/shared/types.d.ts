export type CategoryKey = 'food' | 'safety' | 'gems' | 'cowork' | 'tips' | 'events';
export type FilterKey = CategoryKey | 'all';
export interface Thread {
    title: string;
    subreddit: string;
    upvotes: number;
    comments: number;
    time_ago: string;
    snippet: string;
    tag: CategoryKey;
    place_name?: string;
    lat: number;
    lng: number;
    permalink?: string;
}
export interface Hood {
    n: string;
    lat: number;
    lng: number;
}
export interface City {
    c: [number, number];
    z: number;
    subs: string[];
    bbox: string;
    /** [latLo, latHi, lngLo, lngHi] — used for validating LLM-returned coords. */
    bboxBounds: readonly [number, number, number, number];
    hoods: Hood[];
}
export type CityName = 'San Francisco' | 'New York City' | 'Bogotá' | 'Quito' | 'London' | 'Barcelona' | 'Tokyo';
