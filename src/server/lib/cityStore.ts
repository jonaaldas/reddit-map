import { redis } from '@devvit/web/server';
import type { MapCity } from '@redditmap/shared';

const key = (sub: string) => `cities:${sub}`;
const cacheKey = (sub: string) => `citycache:${sub}`;
const MAX_CITIES = 20;

/**
 * Cache of "text from setting → geocoded MapCity[]" so we don't hit
 * Nominatim every page load. Keyed by the exact text the mod typed —
 * any character change forces a re-geocode.
 */
type CityCache = { text: string; cities: MapCity[]; ts: number };

export async function loadCityCache(sub: string): Promise<CityCache | null> {
  const raw = await redis.get(cacheKey(sub));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CityCache;
    if (typeof parsed.text !== 'string' || !Array.isArray(parsed.cities)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCityCache(sub: string, cache: CityCache): Promise<void> {
  await redis.set(cacheKey(sub), JSON.stringify(cache));
}

export async function clearCityCache(sub: string): Promise<void> {
  await redis.del(cacheKey(sub));
}

export async function loadCities(sub: string): Promise<MapCity[]> {
  const raw = await redis.get(key(sub));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as MapCity[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveCities(sub: string, cities: MapCity[]): Promise<void> {
  // Dedupe by shortName (case-insensitive); preserve order.
  const seen = new Set<string>();
  const deduped: MapCity[] = [];
  for (const c of cities) {
    const k = c.shortName.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(c);
    if (deduped.length >= MAX_CITIES) break;
  }
  await redis.set(key(sub), JSON.stringify(deduped));
}

export async function clearCities(sub: string): Promise<void> {
  await redis.del(key(sub));
}
