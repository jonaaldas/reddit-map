// Tile config for the Devvit iframe. Client-side external requests are blocked
// by Devvit CSP, so Leaflet requests same-origin tiles and the server proxies
// the configured map provider.

import type { CityName } from '../types';

export const TILE_URL = '/api/tiles/{z}/{x}/{y}';
export const TILE_MIN_ZOOM = 6;
export const TILE_MAX_ZOOM = 13;

/** Leaflet expects bounds as [[south, west], [north, east]]. */
export type LatLngBounds = [[number, number], [number, number]];

export type CityRegion = {
  name: CityName;
  bounds: LatLngBounds;
  minZoom: number;
  maxZoom: number;
};

export const CITY_REGIONS: Record<CityName, CityRegion> = {
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

export const SUPPORTED_CITY_NAMES: CityName[] = Object.keys(CITY_REGIONS) as CityName[];

/**
 * A scope is a named bundle of one or more cities, used when a subreddit
 * covers multiple cities at once (e.g. r/InternationalAndes → Quito + Bogotá).
 */
export type ScopeName = 'Andes';

export const CITY_SCOPES: Record<ScopeName, CityName[]> = {
  Andes: ['Quito', 'Bogotá'],
};

export type ScopeRegion = {
  name: ScopeName;
  bounds: LatLngBounds;
  minZoom: number;
  maxZoom: number;
};

export const SCOPE_REGIONS: Record<ScopeName, ScopeRegion> = {
  Andes: {
    name: 'Andes',
    bounds: [[-1.00, -79.50], [5.50, -73.00]],
    minZoom: 6,
    maxZoom: 10,
  },
};

export const SCOPE_NAMES = Object.keys(CITY_SCOPES) as ScopeName[];

export function isScopeName(s: string): s is ScopeName {
  return SCOPE_NAMES.includes(s as ScopeName);
}

/** Resolve any setting value (city or scope name) to a list of cities. */
export function expandToCities(value: string): CityName[] | null {
  if (isScopeName(value)) return [...CITY_SCOPES[value]];
  if ((SUPPORTED_CITY_NAMES as readonly string[]).includes(value)) {
    return [value as CityName];
  }
  return null;
}

/** Combined Leaflet bounds covering every city in the list. */
export function combinedBounds(cities: readonly CityName[]): LatLngBounds {
  let south = 90, west = 180, north = -90, east = -180;
  for (const c of cities) {
    const b = CITY_REGIONS[c].bounds;
    if (b[0][0] < south) south = b[0][0];
    if (b[0][1] < west) west = b[0][1];
    if (b[1][0] > north) north = b[1][0];
    if (b[1][1] > east) east = b[1][1];
  }
  return [[south, west], [north, east]];
}

/** Subreddit name (any case, with or without `r/`) → CityName | null. */
export function inferCityFromSubreddit(subredditName: string | undefined | null): CityName | null {
  if (!subredditName) return null;
  const slug = subredditName
    .toLowerCase()
    .replace(/^r\//, '')
    .replace(/[^a-z]/g, '');

  const map: Record<string, CityName> = {
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

  if (map[slug]) return map[slug];

  for (const [needle, city] of Object.entries(map)) {
    if (slug.includes(needle)) return city;
  }
  return null;
}

/** Subreddit name → scope name, for subs that cover multiple cities. */
export function inferScopeFromSubreddit(subredditName: string | undefined | null): ScopeName | null {
  if (!subredditName) return null;
  const slug = subredditName.toLowerCase().replace(/^r\//, '').replace(/[^a-z]/g, '');
  if (slug.includes('andes') || slug.includes('internationalandes')) return 'Andes';
  return null;
}
