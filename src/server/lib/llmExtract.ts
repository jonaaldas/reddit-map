import { context, settings } from '@devvit/web/server';
import type { MapCity, NormalizedPost } from '@redditmap/shared';
import { appendLlmLog, type LlmLogEntry } from './llmLog';

// Direct OpenAI call from the Devvit server. Per Reddit's docs this is the
// recommended way to add AI to a Devvit app — no apps/api hop required, just
// allowlist `api.openai.com` in `devvit.json` permissions.http.domains and
// store the key as a Devvit app setting (`devvit settings set openaiApiKey ...`).
// Cheap model — read-and-classify is the whole job. Bump to gpt-5.4-mini
// if accuracy drops on edge cases (Italian restaurants vs pizzerias, etc).
const MODEL = 'gpt-4o-mini';
const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

// Default system prompt. Mods can override per-sub via the `aiPromptOverride`
// setting; if blank, we use this. Exposed via `/api/llm-prompt` so the iframe
// debug panel can show + copy it.
export const DEFAULT_SYSTEM_PROMPT =
  'You geocode Reddit posts to ONE kind of venue: restaurants whose ' +
  'primary cuisine is South Asian or East/Southeast Asian. Eligible ' +
  'cuisines: Indian, Pakistani, Bangladeshi, Sri Lankan, Nepali, ' +
  'Tibetan, Bhutanese, Chinese (incl. Cantonese, Szechuan, dim sum, ' +
  'hot pot), Japanese (sushi, ramen, izakaya, yakitori), Korean ' +
  '(BBQ, bibimbap, fried chicken), Thai, Vietnamese (pho, banh mi), ' +
  'Filipino, Malaysian, Indonesian, Singaporean, Burmese, Cambodian, ' +
  'Laotian, Taiwanese, Mongolian. ' +
  'NOTHING ELSE qualifies — not pan-Asian fusion spots that are ' +
  'primarily Western, not general bars/cafes, not coffee shops, not ' +
  'bakeries (unless specifically Asian bakery / bao / banh mi), not ' +
  'non-Asian restaurants. A venue is eligible only if it is primarily ' +
  'known for one of the cuisines listed above. ' +
  'Read the post. If it names ONE specific eligible venue (e.g. ' +
  '"tried Xi\'an Famous Foods", "best pho at Pho 79", "loved the ' +
  'biryani at Karachi Kabab House"), set found=true and return the ' +
  "venue's exact name as place_name plus decimal-degree coordinates " +
  'inside the allowed range. ' +
  'For ANYTHING else — neighborhoods, generic recs without a named ' +
  'venue, non-Asian food, non-food posts — set found=false and ' +
  'place_name="".';

/**
 * Resolves which system prompt to use for this sub. Returns the override
 * if a mod set one, otherwise the default. The active prompt is also
 * surfaced via /api/llm-prompt so mods can compare what they edited
 * against the default.
 */
export async function resolveSystemPrompt(): Promise<{
  prompt: string;
  source: 'override' | 'default';
}> {
  const raw = await settings.get('aiPromptOverride').catch(() => undefined);
  const override = typeof raw === 'string' ? raw.trim() : '';
  if (override.length > 0) return { prompt: override, source: 'override' };
  return { prompt: DEFAULT_SYSTEM_PROMPT, source: 'default' };
}

export type LlmExtractResult = {
  place_name: string;
  lat: number;
  lng: number;
};

type OpenAiChatResponse = {
  choices?: { message?: { content?: string | null } }[];
  error?: { message: string };
};

type ExtractedPlace = {
  found: boolean;
  place_name?: string;
  lat?: number;
  lng?: number;
};

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['found', 'place_name', 'lat', 'lng'],
  properties: {
    found: { type: 'boolean' },
    place_name: { type: 'string' },
    lat: { type: 'number' },
    lng: { type: 'number' },
  },
} as const;

/** Returns null on miss, network error, missing key, or out-of-bbox response. */
export async function llmExtract(
  post: NormalizedPost,
  city: MapCity,
): Promise<LlmExtractResult | null> {
  const baseEntry: Omit<LlmLogEntry, 'outcome'> = {
    ts: Date.now(),
    city: city.shortName,
    candidateId: post.id,
    candidateKind: post.id.startsWith('t1_') ? 'comment' : 'post',
    title: post.title.slice(0, 200),
    body: post.body.slice(0, 400),
    permalink: post.permalink,
  };

  const apiKey = await getApiKey();
  if (!apiKey) {
    console.warn('[llmExtract] OPENAI_API_KEY not configured — skipping');
    await logEntry({ ...baseEntry, outcome: 'no-api-key' });
    return null;
  }

  const [latLo, lngLo, latHi, lngHi] = [city.bbox[0], city.bbox[1], city.bbox[2], city.bbox[3]];
  const { prompt: systemPrompt } = await resolveSystemPrompt();
  const userPrompt =
    `City: ${city.shortName}\n` +
    `Allowed coordinate range: lat ${latLo}..${latHi}, lng ${lngLo}..${lngHi}\n\n` +
    `Title: ${post.title}\n` +
    `Body: ${post.body.slice(0, 2000)}`;

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'extracted_place',
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
      }),
    });
  } catch (e) {
    console.warn('[llmExtract] fetch failed', e);
    await logEntry({ ...baseEntry, outcome: 'fetch-error', errorMessage: String(e) });
    return null;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.warn('[llmExtract] non-2xx', res.status, errText);
    await logEntry({
      ...baseEntry,
      outcome: 'http-error',
      errorMessage: `${res.status} ${errText.slice(0, 200)}`,
    });
    return null;
  }

  const data = (await res.json().catch(() => null)) as OpenAiChatResponse | null;
  if (!data || data.error) {
    console.warn('[llmExtract] error response', data?.error?.message);
    await logEntry({
      ...baseEntry,
      outcome: 'http-error',
      errorMessage: data?.error?.message ?? 'unknown',
    });
    return null;
  }

  const content = data.choices?.[0]?.message?.content ?? '';
  let parsed: ExtractedPlace;
  try {
    parsed = JSON.parse(content) as ExtractedPlace;
  } catch {
    console.warn('[llmExtract] non-JSON content', content.slice(0, 200));
    await logEntry({
      ...baseEntry,
      outcome: 'parse-error',
      llmRaw: content.slice(0, 500),
    });
    return null;
  }

  const titleSlice = post.title.slice(0, 60);
  if (!parsed.found || !parsed.place_name || !isFinite(parsed.lat ?? NaN) || !isFinite(parsed.lng ?? NaN)) {
    console.log(`[llmExtract] SKIP "${titleSlice}" — model returned no venue`);
    await logEntry({ ...baseEntry, outcome: 'miss-not-found', llmRaw: parsed });
    return null;
  }

  // Reject hallucinated coordinates outside the city bbox.
  if (parsed.lat! < latLo || parsed.lat! > latHi || parsed.lng! < lngLo || parsed.lng! > lngHi) {
    console.warn(
      `[llmExtract] DROP-BBOX "${titleSlice}" → ${parsed.place_name} (${parsed.lat},${parsed.lng}) outside`,
      city.bbox,
    );
    await logEntry({ ...baseEntry, outcome: 'drop-bbox', llmRaw: parsed });
    return null;
  }

  console.log(`[llmExtract] HIT  "${titleSlice}" → ${parsed.place_name}`);
  await logEntry({ ...baseEntry, outcome: 'hit', llmRaw: parsed });
  return { place_name: parsed.place_name, lat: parsed.lat!, lng: parsed.lng! };
}

async function logEntry(entry: LlmLogEntry): Promise<void> {
  const sub = context.subredditName;
  if (!sub) return;
  await appendLlmLog(sub, entry);
}

async function getApiKey(): Promise<string | null> {
  const raw = await settings.get('OPENAI_API_KEY').catch(() => undefined);
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return null;
}
