import { Hono } from 'hono';
import { context, scheduler } from '@devvit/web/server';
import type {
  OnAppInstallRequest,
  OnPostCreateRequest,
  OnPostDeleteRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { type NormalizedPost } from '../../shared';
import { createPost } from '../core/post';
import { resolveCity } from '../lib/resolveCity';
import { removePin, upsertPin } from '../lib/pinStore';
import { postToPinSmart } from '../lib/postToPinSmart';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  const input = await c.req.json<OnAppInstallRequest>().catch(() => ({}) as OnAppInstallRequest);
  const sub = context.subredditName;
  if (!sub) {
    return c.json<TriggerResponse>(
      { status: 'error', message: 'subredditName missing from context' },
      400,
    );
  }

  let postNote = '';
  try {
    const post = await createPost();
    postNote = `, post ${post.id}`;
    // Auto-sticky so the map sits at the top of the sub. Position 2 leaves
    // slot 1 for the mod's existing welcome/rules post if any. Best-effort —
    // if the slot is taken or perms refuse, the post still exists, just
    // un-stickied (mod can sticky manually).
    try {
      await post.sticky(2);
    } catch (stickyErr) {
      console.warn('Could not auto-sticky map post', stickyErr);
    }
  } catch (e) {
    console.error('createPost failed during onAppInstall', e);
  }

  const { cityNames } = await resolveCity();
  if (!cityNames.length) {
    return c.json<TriggerResponse>({
      status: 'success',
      message: `Installed in r/${sub}${postNote}. Mod must pick a city in app settings before pins can populate.`,
    });
  }

  const cityLabel = cityNames.join('+');
  // The backfill (top posts + comment trees + an LLM call per candidate) takes
  // minutes — far longer than Devvit allows a trigger handler to run before it
  // cancels us (rpc code=Canceled, install reported as failed). Hand it to a
  // scheduler task that fires a few seconds from now and return immediately.
  try {
    await scheduler.runJob({
      name: 'backfill',
      runAt: new Date(Date.now() + 5_000),
      data: { sub, cityNames },
    });
    return c.json<TriggerResponse>({
      status: 'success',
      message: `Installed in r/${sub}${postNote}, cities=${cityLabel}. Scanning posts in the background — pins will appear shortly (trigger ${input?.type ?? 'unknown'}).`,
    });
  } catch (e) {
    console.error('Failed to schedule backfill', e);
    // Scheduling failed, but the app is installed and the post exists — don't
    // fail the install over a backfill that the mod can re-trigger from the menu.
    return c.json<TriggerResponse>({
      status: 'success',
      message: `Installed in r/${sub}${postNote}, cities=${cityLabel}. Could not start the background scan — use the "re-scan top posts" menu action to populate pins.`,
    });
  }
});

// Phase 3 — every new post in the subreddit gets matched against the gazetteer
// and pinned. Phase 5 — if the gazetteer misses, fall back to LLM extraction
// via the Vercel AI Gateway.
triggers.post('/on-post-create', async (c) => {
  const input = await c.req.json<OnPostCreateRequest>().catch(() => null);
  const post = input?.post;
  const sub = context.subredditName;
  if (!post || !sub) {
    return c.json<TriggerResponse>({ status: 'success', message: 'no post/sub in payload' });
  }

  const { cityNames } = await resolveCity();
  if (!cityNames.length) {
    return c.json<TriggerResponse>({ status: 'success', message: 'no city configured yet' });
  }

  const normalized: NormalizedPost = {
    id: post.id,
    title: post.title,
    body: post.selftext ?? '',
    permalink: post.permalink,
    upvotes: post.score,
    numComments: post.numComments,
    createdUtc: post.createdAt,
  };
  const pin = await postToPinSmart(normalized, cityNames);
  if (!pin) {
    return c.json<TriggerResponse>({ status: 'success', message: `no place match in "${post.title.slice(0, 60)}"` });
  }

  await upsertPin(sub, pin);
  return c.json<TriggerResponse>({
    status: 'success',
    message: `Pinned post ${pin.postId} → ${pin.hood}`,
  });
});

// When a post is deleted, drop its pin so the map doesn't link to a 404.
triggers.post('/on-post-delete', async (c) => {
  const input = await c.req.json<OnPostDeleteRequest>().catch(() => null);
  const sub = context.subredditName;
  if (!sub || !input?.postId) {
    return c.json<TriggerResponse>({ status: 'success', message: 'no postId in payload' });
  }
  const removed = await removePin(sub, input.postId);
  return c.json<TriggerResponse>({
    status: 'success',
    message: removed ? `Removed pin for ${input.postId}` : 'no matching pin',
  });
});
