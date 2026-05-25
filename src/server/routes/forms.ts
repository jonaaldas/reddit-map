import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { resolveCity } from '../lib/resolveCity';
import { backfillSubreddit } from '../lib/backfill';

export const forms = new Hono();

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

  const { cityNames } = await resolveCity();
  if (!cityNames.length) {
    return c.json<UiResponse>(
      { showToast: "Pick a city in this app's settings first" },
      200,
    );
  }

  const cityLabel = cityNames.join(' + ');
  console.log(`[import] START source=r/${source} dest=r/${dest} cities=${cityLabel}`);
  try {
    const result = await backfillSubreddit(dest, cityNames, 100, source);
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
