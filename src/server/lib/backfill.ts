import { reddit } from '@devvit/web/server';
import {
  type CityName,
  type NormalizedPost,
  type Pin,
} from '../../shared';
import { savePins } from './pinStore';
import { llmExtract } from './llmExtract';

// How many LLM extract calls run in parallel during backfill. Keeps us
// well under any provider rate limit and bounds tail latency.
const LLM_CONCURRENCY = 10;

// Reddit's listing API caps any single call at 1000. We scan every timeframe
// so a hot post in /top/hour also surfaces even if it isn't in /top/year yet,
// and dedupe by post id across the union.
const TIMEFRAMES = ['hour', 'day', 'week', 'month', 'year', 'all'] as const;

// Comment-tree scan controls. Reddit threads can have thousands of replies;
// cap per-post fetch to bound LLM cost and wall time. Bump if you see
// venues being missed because they live deep in popular threads.
const COMMENTS_PER_POST = 20;
const COMMENT_TREE_DEPTH = 10;
const COMMENT_FETCH_CONCURRENCY = 5;
// Filter out drive-by replies before sending to the LLM.
const MIN_COMMENT_LENGTH = 20;

export type BackfillResult = {
  scanned: number;
  matched: number;
  pinsWritten: number;
  source: string;
  destination: string;
};

/**
 * Pull top posts from `sourceSubreddit` (defaults to `storeSubreddit`),
 * LLM-extract food/nightlife venues from each one, and write the matches
 * into `redis:pins:{storeSubreddit}`.
 *
 * Production: source === store === the installed sub.
 * Dev: source = a real city sub (e.g. AskNYC), store = your test sub.
 *
 * `perTimeframeLimit` is the cap per timeframe call (Reddit hard-caps at 1000).
 */
export async function backfillSubreddit(
  storeSubreddit: string,
  cities: CityName | readonly CityName[],
  perTimeframeLimit = 1000,
  sourceSubreddit?: string,
): Promise<BackfillResult> {
  const cityList: CityName[] = Array.isArray(cities)
    ? [...cities]
    : [cities as CityName];
  if (!cityList.length) throw new Error('backfillSubreddit: at least one city required');
  const source = sourceSubreddit ?? storeSubreddit;
  const t0 = Date.now();
  console.log(
    `[backfill] START source=r/${source} dest=r/${storeSubreddit} cities=${cityList.join('+')} perTimeframeLimit=${perTimeframeLimit} timeframes=${TIMEFRAMES.join(',')}`,
  );

  const seen = new Set<string>();
  const candidates: NormalizedPost[] = [];

  for (const timeframe of TIMEFRAMES) {
    const tfStart = Date.now();
    let tfCount = 0;
    let tfNew = 0;
    const listing = reddit.getTopPosts({
      subredditName: source,
      timeframe,
      limit: perTimeframeLimit,
    });
    for await (const post of listing) {
      tfCount++;
      if (seen.has(post.id)) continue;
      seen.add(post.id);
      tfNew++;
      candidates.push({
        id: post.id,
        title: post.title,
        body: post.body ?? '',
        permalink: post.permalink,
        upvotes: post.score,
        numComments: post.numberOfComments,
        createdUtc: Math.floor(post.createdAt.getTime() / 1000),
      });
    }
    console.log(
      `[backfill] timeframe=${timeframe} fetched=${tfCount} new=${tfNew} (running unique=${candidates.length}) in ${Date.now() - tfStart}ms`,
    );
  }
  const postCount = candidates.length;
  console.log(
    `[backfill] FETCHED ${postCount} unique posts in ${Date.now() - t0}ms, starting comment-tree scan (concurrency ${COMMENT_FETCH_CONCURRENCY}, ${COMMENTS_PER_POST}/post)`,
  );

  // Walk each post's comment tree and add comments as pseudo-NormalizedPosts
  // so the same LLM batch loop scans them. Comments link back to their own
  // permalink, so a hit pins to the comment URL, not the parent post.
  const commentsStart = Date.now();
  let totalComments = 0;
  for (let i = 0; i < candidates.length; i += COMMENT_FETCH_CONCURRENCY) {
    const batch = candidates.slice(i, i + COMMENT_FETCH_CONCURRENCY).filter((p) => p.id.startsWith('t3_'));
    const batchResults = await Promise.all(
      batch.map((post) => fetchCommentsAsCandidates(post)),
    );
    for (const comments of batchResults) {
      for (const c of comments) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        candidates.push(c);
        totalComments++;
      }
    }
  }
  console.log(
    `[backfill] COMMENTS ${totalComments} added from ${postCount} posts in ${Date.now() - commentsStart}ms (total candidates ${candidates.length})`,
  );

  const scanned = candidates.length;

  // LLM extract for every candidate (posts + comments), batched by LLM_CONCURRENCY.
  // For multi-city scopes we call llmExtract once per (post, city) — the bbox
  // guard inside llmExtract drops hits that fall outside that city, so the
  // first city whose bbox contains the venue wins. Order in `cityList`
  // therefore matters; put the most likely city first if precision matters.
  const pins: Pin[] = [];
  const totalBatches = Math.ceil(candidates.length / LLM_CONCURRENCY);
  for (let i = 0; i < candidates.length; i += LLM_CONCURRENCY) {
    const batchIdx = i / LLM_CONCURRENCY + 1;
    const batch = candidates.slice(i, i + LLM_CONCURRENCY);
    const batchStart = Date.now();
    const results = await Promise.all(
      batch.map(async (p) => {
        for (const city of cityList) {
          const hit = await llmExtract(p, city);
          if (hit) return { city, hit };
        }
        return null;
      }),
    );
    let batchHits = 0;
    for (let j = 0; j < batch.length; j++) {
      const result = results[j];
      const post = batch[j]!;
      if (!result) continue;
      batchHits++;
      pins.push({
        postId: post.id.replace(/^t[0-9]+_/, ''),
        title: post.title,
        permalink: post.permalink,
        upvotes: post.upvotes,
        numComments: post.numComments,
        createdUtc: post.createdUtc,
        hood: result.hit.place_name,
        lat: result.hit.lat,
        lng: result.hit.lng,
        city: result.city,
      });
    }
    console.log(
      `[backfill] batch ${batchIdx}/${totalBatches}: +${batchHits} pins (running total ${pins.length}) in ${Date.now() - batchStart}ms`,
    );
  }

  await savePins(storeSubreddit, pins);
  console.log(
    `[backfill] DONE matched ${pins.length}/${scanned} in ${Math.round((Date.now() - t0) / 1000)}s`,
  );
  return {
    scanned,
    matched: pins.length,
    pinsWritten: pins.length,
    source,
    destination: storeSubreddit,
  };
}

/**
 * Fetch a post's comment tree and return each substantive comment as a
 * pseudo-NormalizedPost — title is the parent post's title (to give the LLM
 * context), body is the comment text, permalink points at the comment so
 * pin clicks deep-link to the source reply.
 */
async function fetchCommentsAsCandidates(
  parent: NormalizedPost,
): Promise<NormalizedPost[]> {
  const out: NormalizedPost[] = [];
  try {
    const listing = reddit.getComments({
      postId: parent.id,
      depth: COMMENT_TREE_DEPTH,
      limit: COMMENTS_PER_POST,
    });
    for await (const c of listing) {
      if (out.length >= COMMENTS_PER_POST) break;
      const body = c.body ?? '';
      if (body.length < MIN_COMMENT_LENGTH) continue;
      out.push({
        id: c.id,
        title: parent.title,
        body,
        permalink: c.permalink,
        upvotes: c.score ?? 0,
        numComments: 0,
        createdUtc: Math.floor(c.createdAt.getTime() / 1000),
      });
    }
  } catch (e) {
    console.warn(`[backfill] comments fetch failed for ${parent.id}`, e);
  }
  return out;
}
