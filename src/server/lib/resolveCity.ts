import { context, settings } from '@devvit/web/server';
import {
  CITIES,
  CITY_REGIONS,
  CITY_SCOPES,
  SUPPORTED_CITY_NAMES,
  expandToCities,
  inferCityFromSubreddit,
  inferScopeFromSubreddit,
  isScopeName,
  type CityName,
  type MapCity,
  type ScopeName,
} from '@redditmap/shared';
import { loadCities, loadCityCache, saveCityCache } from './cityStore';
import { geocodeCity } from './geocode';

const VALID_CITY = new Set<string>(SUPPORTED_CITY_NAMES);

/**
 * Match a free-text line against the bundled gazetteer FIRST (instant, no
 * network call, tiles guaranteed to exist). Returns one or more MapCity
 * objects (scopes expand to multiple). Returns null if no preset match.
 *
 * Examples that match presets:
 *   "Quito"       → [Quito]
 *   "quito, ecuador" → [Quito]   (city name prefix match)
 *   "Andes"       → [Quito, Bogotá]   (scope expansion)
 *   "Bogota"      → [Bogotá]    (accent-insensitive)
 */
function matchPreset(line: string): MapCity[] | null {
  const norm = line
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .trim();

  // Scope match (e.g. "andes")
  for (const name of Object.keys(CITY_SCOPES) as ScopeName[]) {
    if (norm === name.toLowerCase()) {
      const list = expandToCities(name);
      if (list && list.length) return list.map(toMapCity);
    }
  }

  // City match (exact, or "city, country" — match by leading segment)
  const firstSeg = norm.split(',')[0]!.trim();
  for (const cn of SUPPORTED_CITY_NAMES) {
    const cityNorm = cn
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    if (firstSeg === cityNorm || norm === cityNorm) {
      return [toMapCity(cn)];
    }
  }

  // Also accept the scope keyword inside a longer string ("andes region")
  for (const name of Object.keys(CITY_SCOPES) as ScopeName[]) {
    if (isScopeName(name) && norm.includes(name.toLowerCase())) {
      const list = expandToCities(name);
      if (list && list.length) return list.map(toMapCity);
    }
  }

  return null;
}

function normalizeSetting(raw: unknown): string | undefined {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return undefined;
}

export type CityResolution = {
  cities: MapCity[];
  source:
    | 'setting-cities-cached'
    | 'setting-cities-geocoded'
    | 'redis-menu'
    | 'setting-cityname'
    | 'inferred-scope'
    | 'inferred-city'
    | 'none';
  /** Lines from the `cities` setting that didn't resolve to a place (if any). */
  failedLines?: string[];
  debug: {
    rawSetting: unknown;
    normalizedSetting: string | undefined;
    citiesSettingText: string | undefined;
    subredditName: string | undefined;
    redisCityCount: number;
  };
};

function toMapCity(name: CityName): MapCity {
  const c = CITIES[name];
  const r = CITY_REGIONS[name];
  const [[s, w], [n, e]] = r.bounds;
  return {
    name,
    shortName: name,
    lat: c.c[0],
    lng: c.c[1],
    bbox: [s, w, n, e],
  };
}

/**
 * Reads the `cities` paragraph setting, returns cached MapCity[] if the text
 * hasn't changed since last geocode. On change (or first run) geocodes each
 * non-blank line via Nominatim, writes the new cache, returns the result.
 *
 * First load after editing the setting takes ~1 sec per line; subsequent
 * loads are instant.
 */
async function resolveFromCitiesSetting(
  sub: string,
  text: string,
): Promise<{ cities: MapCity[]; failed: string[]; fromCache: boolean }> {
  const cached = await loadCityCache(sub);
  if (cached && cached.text === text) {
    return { cities: cached.cities, failed: [], fromCache: true };
  }

  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const cities: MapCity[] = [];
  const seen = new Set<string>();
  const failed: string[] = [];

  for (const line of lines) {
    // Try preset (bundled gazetteer) FIRST. Instant, no network, tiles
    // guaranteed to exist. Only fall back to Nominatim for unknown cities,
    // and even then only if the geocoder works (will fail today until the
    // domain is approved).
    const preset = matchPreset(line);
    if (preset && preset.length) {
      for (const c of preset) {
        if (seen.has(c.shortName.toLowerCase())) continue;
        seen.add(c.shortName.toLowerCase());
        cities.push(c);
      }
      continue;
    }

    const geocoded = await geocodeCity(line);
    if (geocoded) {
      if (!seen.has(geocoded.shortName.toLowerCase())) {
        seen.add(geocoded.shortName.toLowerCase());
        cities.push(geocoded);
      }
    } else {
      failed.push(line);
    }
  }

  await saveCityCache(sub, { text, cities, ts: Date.now() });
  return { cities, failed, fromCache: false };
}

export async function resolveCity(): Promise<CityResolution> {
  const subredditName = context.subredditName;
  const rawCityNameSetting = await settings.get('cityName').catch(() => undefined);
  const normalizedSetting = normalizeSetting(rawCityNameSetting);

  const rawCitiesSetting = await settings.get('cities').catch(() => undefined);
  const citiesSettingText =
    typeof rawCitiesSetting === 'string' ? rawCitiesSetting.trim() : undefined;

  // Build debug payload up front; redisCityCount is only needed in fallback.
  const baseDebug = {
    rawSetting: rawCityNameSetting,
    normalizedSetting,
    citiesSettingText,
    subredditName,
    redisCityCount: 0,
  };

  // 1. New `cities` paragraph setting — geocode-on-change, cached in Redis.
  if (subredditName && citiesSettingText) {
    const { cities, failed, fromCache } = await resolveFromCitiesSetting(
      subredditName,
      citiesSettingText,
    );
    if (cities.length) {
      return {
        cities,
        source: fromCache ? 'setting-cities-cached' : 'setting-cities-geocoded',
        failedLines: failed.length ? failed : undefined,
        debug: { ...baseDebug, redisCityCount: cities.length },
      };
    }
    // Setting present but everything failed — fall through to legacy paths so
    // the iframe still renders something, and `failedLines` surfaces in debug.
  }

  // 2. Legacy mod-form Redis path (kept for back-compat).
  const redisCities = subredditName ? await loadCities(subredditName) : [];
  if (redisCities.length) {
    return {
      cities: redisCities,
      source: 'redis-menu',
      failedLines: undefined,
      debug: { ...baseDebug, redisCityCount: redisCities.length },
    };
  }

  // 3. Legacy single `cityName` select.
  if (normalizedSetting) {
    const expanded = expandToCities(normalizedSetting);
    if (expanded && expanded.length) {
      return {
        cities: expanded.map(toMapCity),
        source: 'setting-cityname',
        debug: baseDebug,
      };
    }
  }

  // 4. Inferred scope from sub name.
  const scope = inferScopeFromSubreddit(subredditName);
  if (scope) {
    const expanded = expandToCities(scope);
    if (expanded && expanded.length) {
      return {
        cities: expanded.map(toMapCity),
        source: 'inferred-scope',
        debug: baseDebug,
      };
    }
  }

  // 5. Inferred single city.
  const inferred = inferCityFromSubreddit(subredditName);
  if (inferred && VALID_CITY.has(inferred)) {
    return {
      cities: [toMapCity(inferred)],
      source: 'inferred-city',
      debug: baseDebug,
    };
  }

  return { cities: [], source: 'none', debug: baseDebug };
}
