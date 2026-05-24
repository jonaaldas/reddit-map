import type { MapCity } from '@redditmap/shared';

// Nominatim's usage policy requires a custom User-Agent. Keep low traffic
// (it's a free community service) — this app only calls it during mod
// configuration, never at user-render time.
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const UA = 'RedditMaps Devvit app (https://github.com/jonaaldas/redditMap)';

type NominatimResult = {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
  type?: string;
  class?: string;
};

/**
 * Resolve a free-text query (e.g. "Quito Ecuador" or "Tokyo") to a single
 * MapCity. Picks the highest-ranked result with class=place or boundary.
 * Returns null if no plausible match.
 */
export async function geocodeCity(query: string): Promise<MapCity | null> {
  const q = query.trim();
  if (!q) return null;

  // Free-text search — `featuretype=city` is too restrictive and rejects
  // results that should clearly match (e.g. "Quito, Ecuador"). Let Nominatim
  // rank, then filter for place/boundary class which covers cities + admin
  // boundaries.
  const url =
    `${NOMINATIM}?q=${encodeURIComponent(q)}` +
    `&format=json&limit=10&addressdetails=0`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        'Accept-Language': 'en',
      },
    });
  } catch (e) {
    console.warn(`[geocode] fetch failed "${q}"`, e);
    return null;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[geocode] non-2xx "${q}" status=${res.status} body=${body.slice(0, 200)}`);
    return null;
  }

  const results = (await res.json().catch(() => null)) as NominatimResult[] | null;
  if (!results || !results.length) {
    console.warn(`[geocode] zero results for "${q}"`);
    return null;
  }

  // Prefer place (city/town/village) or boundary (admin areas); fall back to first.
  const preferred =
    results.find((r) => r.class === 'place' || r.class === 'boundary') ?? results[0]!;
  console.log(
    `[geocode] OK "${q}" → ${preferred.display_name} (class=${preferred.class} type=${preferred.type})`,
  );

  const lat = parseFloat(preferred.lat);
  const lng = parseFloat(preferred.lon);
  const [s, n, w, e] = preferred.boundingbox.map(parseFloat) as [number, number, number, number];
  if ([lat, lng, s, n, w, e].some((v) => !isFinite(v))) return null;

  const shortName = (preferred.name ?? preferred.display_name.split(',')[0] ?? q).trim();
  return {
    name: preferred.display_name,
    shortName,
    lat,
    lng,
    bbox: [s, w, n, e],
  };
}
