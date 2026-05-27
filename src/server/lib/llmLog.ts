import { redis } from '@devvit/web/server';
import type { CityName } from '../../shared';

// Bounded JSON-blob log of every LLM call. Cheap, no list ops needed.
// Kept per-sub so the dev playtest sub doesn't pollute prod.
const MAX_ENTRIES = 500;
const key = (sub: string) => `llmlog:${sub}`;

export type LlmLogEntry = {
  ts: number;                       // epoch ms
  city: CityName;
  candidateId: string;              // post or comment id (t3_/t1_)
  candidateKind: 'post' | 'comment';
  title: string;                    // truncated
  body: string;                     // truncated
  permalink: string;
  outcome:
    | 'hit'
    | 'miss-not-found'               // model returned found=false
    | 'drop-bbox'                    // hit but coords outside city bbox
    | 'parse-error'                  // non-JSON response
    | 'http-error'                   // non-2xx from OpenAI
    | 'fetch-error'                  // network failure
    | 'no-api-key';
  llmRaw?: unknown;                  // the parsed JSON we got back (if any)
  errorMessage?: string;
};

export async function appendLlmLog(sub: string, entry: LlmLogEntry): Promise<void> {
  try {
    const existing = await loadLlmLog(sub);
    // Newest first; trim from the end.
    existing.unshift(entry);
    const trimmed = existing.slice(0, MAX_ENTRIES);
    await redis.set(key(sub), JSON.stringify(trimmed));
  } catch (e) {
    // Logging failures must never break the main flow.
    console.warn('[llmLog] write failed', e);
  }
}

export async function loadLlmLog(sub: string): Promise<LlmLogEntry[]> {
  const raw = await redis.get(key(sub));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LlmLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function clearLlmLog(sub: string): Promise<void> {
  await redis.del(key(sub));
}
