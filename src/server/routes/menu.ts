import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import { resolveCity } from '../lib/resolveCity';
import { backfillSubreddit } from '../lib/backfill';
import { clearPins } from '../lib/pinStore';
import { clearLlmLog } from '../lib/llmLog';
import { loadCities } from '../lib/cityStore';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const post = await createPost();
    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      },
      200,
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>({ showToast: 'Failed to create post' }, 400);
  }
});

menu.post('/rescan', async (c) => {
  const sub = context.subredditName;
  if (!sub) return c.json<UiResponse>({ showToast: 'subreddit missing' }, 400);

  const { cities } = await resolveCity();
  if (!cities.length) {
    return c.json<UiResponse>(
      { showToast: 'Configure cities via "RedditMaps: configure cities" first.' },
      200,
    );
  }

  const cityLabel = cities.map((c) => c.shortName).join(' + ');
  console.log(`[rescan] START sub=r/${sub} cities=${cityLabel}`);
  try {
    const result = await backfillSubreddit(sub, cities, 100);
    console.log(
      `[rescan] DONE matched=${result.matched}/${result.scanned} → r/${sub}`,
    );
    return c.json<UiResponse>(
      {
        showToast: `Pinned ${result.matched}/${result.scanned} Asian restaurants to ${cityLabel}.`,
      },
      200,
    );
  } catch (e) {
    console.error('[rescan] FAILED', e);
    return c.json<UiResponse>(
      { showToast: 'Re-scan failed (see app logs).' },
      500,
    );
  }
});

menu.post('/clear-pins', async (c) => {
  const sub = context.subredditName;
  if (!sub) return c.json<UiResponse>({ showToast: 'subreddit missing' }, 400);
  await clearPins(sub);
  return c.json<UiResponse>({ showToast: 'Cleared all pins for this subreddit.' }, 200);
});

menu.post('/clear-llm-log', async (c) => {
  const sub = context.subredditName;
  if (!sub) return c.json<UiResponse>({ showToast: 'subreddit missing' }, 400);
  await clearLlmLog(sub);
  return c.json<UiResponse>({ showToast: 'Cleared LLM debug log.' }, 200);
});

// Opens the "Configure cities" form. The submit handler in forms.ts geocodes
// each line via Nominatim and stores the result in redis:cities:{sub}.
menu.post('/configure-cities', async (_c) => {
  const sub = context.subredditName;
  const existing = sub ? await loadCities(sub) : [];
  const defaultValue = existing.length
    ? existing.map((c) => c.shortName).join('\n')
    : 'Quito, Ecuador\nBogotá, Colombia';
  return _c.json<UiResponse>({
    showForm: {
      name: 'cityConfig',
      form: {
        title: 'Configure cities for this map',
        description:
          'Type one city per line (e.g. "Quito, Ecuador"). The server resolves each via OpenStreetMap and stores the matching bounding box. Saving replaces the current list. Up to 20 cities.',
        fields: [
          {
            type: 'paragraph',
            name: 'cityList',
            label: 'Cities (one per line)',
            helpText:
              'Examples:\n  Tokyo, Japan\n  Lima, Peru\n  Williamsburg, Brooklyn  (any place name works)',
            defaultValue,
            required: true,
          },
        ],
        acceptLabel: 'Save cities',
        cancelLabel: 'Cancel',
      },
    },
  });
});

// Dev-only helper: pulls top posts from another (real) subreddit and pins them
// into THIS sub's redis. Lets you populate the map for testing without having
// real city posts of your own.
menu.post('/import-form', async (_c) => {
  return _c.json<UiResponse>({
    showForm: {
      name: 'importForm',
      form: {
        title: 'Import demo data',
        description:
          "Pulls the top 100 posts from another subreddit and pins any that mention a known neighborhood for the city this app is configured to. Useful for filling the map with realistic content during testing.",
        fields: [
          {
            type: 'string',
            name: 'sourceSubreddit',
            label: 'Source subreddit (without r/)',
            helpText: 'e.g. AskNYC, london, sanfrancisco',
            required: true,
          },
        ],
        acceptLabel: 'Import',
        cancelLabel: 'Cancel',
      },
    },
  });
});
