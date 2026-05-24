import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import { resolveCity } from '../lib/resolveCity';
import { loadPins } from '../lib/pinStore';
import { loadLlmLog } from '../lib/llmLog';
import { DEFAULT_SYSTEM_PROMPT, resolveSystemPrompt } from '../lib/llmExtract';

export const api = new Hono();

// Returns the full resolution (cityName + source + debug) — the iframe shows
// the debug block when cityName is null so we can see why.
api.get('/config', async (c) => {
  const resolved = await resolveCity();
  return c.json(resolved);
});

api.get('/pins', async (c) => {
  const sub = context.subredditName;
  if (!sub) return c.json({ pins: [] });
  const pins = await loadPins(sub);
  return c.json({ pins });
});

// Returns the default prompt + the currently active prompt (override or
// default) so the iframe debug panel can show + copy them.
api.get('/llm-prompt', async (c) => {
  const { prompt, source } = await resolveSystemPrompt();
  return c.json({ default: DEFAULT_SYSTEM_PROMPT, active: prompt, source });
});

// Inspect every LLM call (hit/miss/error) for this sub. Optionally filter
// to a single outcome via ?outcome=miss-not-found etc. Useful for debugging
// why pins aren't appearing.
api.get('/llm-log', async (c) => {
  const sub = context.subredditName;
  if (!sub) return c.json({ entries: [], total: 0 });
  const filter = c.req.query('outcome');
  const entries = await loadLlmLog(sub);
  const filtered = filter ? entries.filter((e) => e.outcome === filter) : entries;
  const counts: Record<string, number> = {};
  for (const e of entries) counts[e.outcome] = (counts[e.outcome] ?? 0) + 1;
  return c.json({ total: entries.length, counts, entries: filtered });
});
