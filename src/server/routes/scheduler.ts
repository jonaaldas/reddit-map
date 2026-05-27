import { Hono } from 'hono';
import type { TaskRequest, TaskResponse } from '@devvit/web/server';
import { type CityName } from '../../shared';
import { backfillSubreddit } from '../lib/backfill';

export const scheduler = new Hono();

type BackfillJobData = {
  sub: string;
  cityNames: CityName[];
};

// Runs the heavy top-posts + comment-tree + LLM backfill OUT of the install
// trigger / menu request, which Devvit cancels if it runs more than a few
// seconds. Scheduled via scheduler.runJob({ name: 'backfill', ... }); the task
// name maps to this endpoint in devvit.json. Returns the empty TaskResponse.
scheduler.post('/backfill', async (c) => {
  const body = await c.req.json<TaskRequest<BackfillJobData>>().catch(() => null);
  const data = body?.data;
  const sub = data?.sub;
  const cityNames = data?.cityNames ?? [];
  if (!sub || !cityNames.length) {
    console.warn('[scheduler:backfill] missing sub/cityNames in job data', data);
    return c.json<TaskResponse>({});
  }

  console.log(`[scheduler:backfill] START sub=r/${sub} cities=${cityNames.join('+')}`);
  try {
    const result = await backfillSubreddit(sub, cityNames, 100);
    console.log(
      `[scheduler:backfill] DONE matched=${result.matched}/${result.scanned} → r/${sub}`,
    );
  } catch (e) {
    console.error('[scheduler:backfill] FAILED', e);
  }
  return c.json<TaskResponse>({});
});
