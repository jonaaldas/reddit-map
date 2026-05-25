import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import { resolveCity } from '../lib/resolveCity';
import { backfillSubreddit } from '../lib/backfill';
import { clearPins } from '../lib/pinStore';
import { clearLlmLog } from '../lib/llmLog';

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

  const { cityNames } = await resolveCity();
  if (!cityNames.length) {
    return c.json<UiResponse>(
      { showToast: 'Pick a city in this app\'s settings first.' },
      200,
    );
  }

  const cityLabel = cityNames.join(' + ');
  console.log(`[rescan] START sub=r/${sub} cities=${cityLabel}`);
  try {
    const result = await backfillSubreddit(sub, cityNames, 100);
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
