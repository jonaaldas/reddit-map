// Tile config for the Devvit iframe. Client-side external requests are blocked
// by Devvit CSP, so Leaflet requests same-origin tiles and the server proxies
// the configured map provider.
export const TILE_URL = '/api/tiles/{z}/{x}/{y}';
export const TILE_MIN_ZOOM = 6;
export const TILE_MAX_ZOOM = 13;
export const CITY_REGIONS = {
    'San Francisco': {
        name: 'San Francisco',
        bounds: [[37.70, -122.52], [37.84, -122.34]],
        minZoom: 11,
        maxZoom: 13,
    },
    'New York City': {
        name: 'New York City',
        bounds: [[40.55, -74.06], [40.92, -73.70]],
        minZoom: 11,
        maxZoom: 13,
    },
    London: {
        name: 'London',
        bounds: [[51.40, -0.31], [51.62, 0.03]],
        minZoom: 11,
        maxZoom: 13,
    },
    Barcelona: {
        name: 'Barcelona',
        bounds: [[41.32, 2.07], [41.48, 2.24]],
        minZoom: 11,
        maxZoom: 13,
    },
    'Bogotá': {
        name: 'Bogotá',
        bounds: [[4.50, -74.20], [4.83, -73.99]],
        minZoom: 11,
        maxZoom: 13,
    },
    Quito: {
        name: 'Quito',
        bounds: [[-0.40, -78.65], [0.00, -78.35]],
        minZoom: 11,
        maxZoom: 13,
    },
    Tokyo: {
        name: 'Tokyo',
        bounds: [[35.50, 139.45], [35.90, 139.95]],
        minZoom: 10,
        maxZoom: 13,
    },
};
export const SUPPORTED_CITY_NAMES = Object.keys(CITY_REGIONS);
export const CITY_SCOPES = {
    Andes: ['Quito', 'Bogotá'],
};
export const SCOPE_REGIONS = {
    Andes: {
        name: 'Andes',
        bounds: [[-1.00, -79.50], [5.50, -73.00]],
        minZoom: 6,
        maxZoom: 10,
    },
};
export const SCOPE_NAMES = Object.keys(CITY_SCOPES);
export function isScopeName(s) {
    return SCOPE_NAMES.includes(s);
}
const CITY_ALIASES = {
    sf: 'San Francisco',
    bayarea: 'San Francisco',
    nyc: 'New York City',
    newyork: 'New York City',
    newyorkcity: 'New York City',
    bogota: 'Bogotá',
};
function searchKey(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}
const CITY_BY_SEARCH_KEY = Object.fromEntries([
    ...SUPPORTED_CITY_NAMES.map((cityName) => [searchKey(cityName), cityName]),
    ...Object.entries(CITY_ALIASES),
]);
const SCOPE_BY_SEARCH_KEY = Object.fromEntries([
    ...SCOPE_NAMES.map((scopeName) => [searchKey(scopeName), scopeName]),
    ['andesquitobogota', 'Andes'],
]);
function uniqueCities(cityNames) {
    return [...new Set(cityNames)];
}
function splitCitySearch(value) {
    return value
        .split(/[,;\n]|\s+\+\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
}
function expandSingleCitySearch(value) {
    const directScope = SCOPE_BY_SEARCH_KEY[searchKey(value)];
    if (directScope)
        return [...CITY_SCOPES[directScope]];
    const city = CITY_BY_SEARCH_KEY[searchKey(value)];
    if (city)
        return [city];
    return null;
}
/** Resolve any setting value (city, scope name, or comma-separated city list) to a list of cities. */
export function expandToCities(value) {
    const wholeValue = expandSingleCitySearch(value);
    if (wholeValue)
        return uniqueCities(wholeValue);
    const cityNames = [];
    for (const part of splitCitySearch(value)) {
        const cities = expandSingleCitySearch(part);
        if (!cities)
            return null;
        cityNames.push(...cities);
    }
    return cityNames.length ? uniqueCities(cityNames) : null;
}
/** Combined Leaflet bounds covering every city in the list. */
export function combinedBounds(cities) {
    let south = 90, west = 180, north = -90, east = -180;
    for (const c of cities) {
        const b = CITY_REGIONS[c].bounds;
        if (b[0][0] < south)
            south = b[0][0];
        if (b[0][1] < west)
            west = b[0][1];
        if (b[1][0] > north)
            north = b[1][0];
        if (b[1][1] > east)
            east = b[1][1];
    }
    return [[south, west], [north, east]];
}
/** Subreddit name (any case, with or without `r/`) → CityName | null. */
export function inferCityFromSubreddit(subredditName) {
    if (!subredditName)
        return null;
    const slug = subredditName
        .toLowerCase()
        .replace(/^r\//, '')
        .replace(/[^a-z]/g, '');
    const map = {
        sanfrancisco: 'San Francisco',
        sf: 'San Francisco',
        asksf: 'San Francisco',
        bayarea: 'San Francisco',
        nyc: 'New York City',
        asknyc: 'New York City',
        newyork: 'New York City',
        newyorkcity: 'New York City',
        brooklyn: 'New York City',
        manhattan: 'New York City',
        queens: 'New York City',
        bronx: 'New York City',
        london: 'London',
        askuk: 'London',
        unitedkingdom: 'London',
        barcelona: 'Barcelona',
        catalonia: 'Barcelona',
        bogota: 'Bogotá',
        bogotá: 'Bogotá',
        colombia: 'Bogotá',
        quito: 'Quito',
        ecuador: 'Quito',
        tokyo: 'Tokyo',
        japan: 'Tokyo',
        japantravel: 'Tokyo',
    };
    if (map[slug])
        return map[slug];
    for (const [needle, city] of Object.entries(map)) {
        if (slug.includes(needle))
            return city;
    }
    return null;
}
/** Subreddit name → scope name, for subs that cover multiple cities. */
export function inferScopeFromSubreddit(subredditName) {
    if (!subredditName)
        return null;
    const slug = subredditName.toLowerCase().replace(/^r\//, '').replace(/[^a-z]/g, '');
    if (slug.includes('andes') || slug.includes('internationalandes'))
        return 'Andes';
    return null;
}
//# sourceMappingURL=mapBounds.js.map