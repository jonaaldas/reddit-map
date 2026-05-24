import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import type { MapCity } from '@redditmap/shared';
import { resolveCity } from '../lib/resolveCity';
import { backfillSubreddit } from '../lib/backfill';
import { geocodeCity } from '../lib/geocode';
import { saveCities, loadCities } from '../lib/cityStore';

export const forms = new Hono();

// Submit handler for "RedditMaps: configure cities". Each line in the
// paragraph field is geocoded via Nominatim; the matching bbox/center are
// stored in redis:cities:{sub}. Saving fully replaces the existing list.
forms.post('/city-config-submit', async (c) => {
  const sub = context.subredditName;
  if (!sub) return c.json<UiResponse>({ showToast: 'Subreddit context missing' }, 400);

  const body = await c.req.json<{ cityList?: string }>().catch(() => ({} as { cityList?: string }));
  const raw = (body.cityList ?? '').trim();
  if (!raw) {
    return c.json<UiResponse>({ showToast: 'No cities entered' }, 200);
  }

  const lines = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (!lines.length) {
    return c.json<UiResponse>({ showToast: 'No cities entered' }, 200);
  }

  console.log(`[city-config] geocoding ${lines.length} entries for r/${sub}`);
  const resolved: MapCity[] = [];
  const failed: string[] = [];
  for (const line of lines) {
    const city = await geocodeCity(line);
    if (city) resolved.push(city);
    else failed.push(line);
  }

  if (!resolved.length) {
    return c.json<UiResponse>(
      { showToast: `No matches found for: ${failed.slice(0, 3).join(', ')}` },
      200,
    );
  }

  await saveCities(sub, resolved);
  const labels = resolved.map((c) => c.shortName).join(', ');
  const tail = failed.length ? ` (skipped: ${failed.slice(0, 3).join(', ')})` : '';
  return c.json<UiResponse>(
    { showToast: `Saved ${resolved.length} cities: ${labels}${tail}` },
    200,
  );
});

// Quick mod menu echo of the currently configured city list (read-only).
forms.post('/city-list-submit', async (c) => {
  const sub = context.subredditName;
  if (!sub) return c.json<UiResponse>({ showToast: 'Subreddit context missing' }, 400);
  const cities = await loadCities(sub);
  if (!cities.length) return c.json<UiResponse>({ showToast: 'No cities configured' }, 200);
  const summary = cities.map((c) => c.shortName).join(', ');
  return c.json<UiResponse>({ showToast: `${cities.length} cities: ${summary}` }, 200);
});

// Submit handler for the "Import demo data" mod menu form (see menu.ts).
forms.post('/import-submit', async (c) => {
  const body = await c.req
    .json<{ sourceSubreddit?: string }>()
    .catch((): { sourceSubreddit?: string } => ({}));
  const raw = (body.sourceSubreddit ?? '').trim();
  const source = raw.replace(/^\/?r\//i, ''); // accept "r/AskNYC", "/r/AskNYC", or just "AskNYC"

  const dest = context.subredditName;
  if (!dest) return c.json<UiResponse>({ showToast: 'Subreddit context missing' }, 400);
  if (!source) return c.json<UiResponse>({ showToast: 'Enter a subreddit name' }, 400);

  const { cities } = await resolveCity();
  if (!cities.length) {
    return c.json<UiResponse>(
      { showToast: 'Configure cities via "RedditMaps: configure cities" first.' },
      200,
    );
  }

  const cityLabel = cities.map((c) => c.shortName).join(' + ');
  console.log(`[import] START source=r/${source} dest=r/${dest} cities=${cityLabel}`);
  try {
    const result = await backfillSubreddit(dest, cities, 100, source);
    console.log(
      `[import] DONE matched=${result.matched}/${result.scanned} from r/${source} → r/${dest}`,
    );
    return c.json<UiResponse>(
      {
        showToast: `Imported ${result.matched}/${result.scanned} Asian restaurants from r/${source} → ${cityLabel}`,
      },
      200,
    );
  } catch (e) {
    console.error('[import] FAILED', e);
    const msg = e instanceof Error ? e.message : 'unknown error';
    return c.json<UiResponse>(
      { showToast: `Import failed: ${msg.slice(0, 80)}` },
      500,
    );
  }
});
